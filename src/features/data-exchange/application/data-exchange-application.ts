import {
  parseImportCommitResult,
} from "../schemas/import-commit-schema";
import {
  parseImportContextSnapshot,
} from "../schemas/import-context-schema";
import { parseParsedImportFile } from "../schemas/contract-source-schema";
import type {
  DataExchangeRepository,
  ImportContextReader,
} from "../repositories/data-exchange-repository";
import {
  buildImportCommitRequest,
  validateImportCommitResult,
} from "../services/import-commit-builder";
import {
  buildImportPreview,
  prepareImportFile,
} from "../services/import-preview";
import type { ImportCommitResult } from "../types/import-commit";
import {
  DataExchangeError,
  DataExchangeApplicationError,
  DataExchangeValidationError,
} from "../types/data-exchange-error";
import type { ContractImportPreview } from "../types/import-preview";

export type ImportPreviewOperation =
  | { readonly status: "ready"; readonly preview: ContractImportPreview }
  | { readonly status: "cancelled" | "stale" };

export type ImportCommitOperation =
  | { readonly status: "completed"; readonly result: ImportCommitResult }
  | { readonly status: "stale" };

export type PreviewIdFactory = () => string;

const defaultPreviewId: PreviewIdFactory = () => globalThis.crypto.randomUUID();

export class DataExchangeApplication {
  private sequence = 0;
  private currentPreview: ContractImportPreview | null = null;
  private commitInFlight = false;

  constructor(
    private readonly repository: DataExchangeRepository,
    private readonly contextReader: ImportContextReader,
    private readonly createPreviewId: PreviewIdFactory = defaultPreviewId,
  ) {}

  async chooseFile(): Promise<ImportPreviewOperation> {
    if (this.commitInFlight) throw busyError();
    const operation = ++this.sequence;
    try {
      const selected = await this.repository.chooseFile();
      if (this.isStale(operation)) return { status: "stale" };
      if (selected === null) return { status: "cancelled" };

      const prepared = prepareImportFile(parseParsedImportFile(selected));
      const context = parseImportContextSnapshot(
        await this.contextReader.load(prepared.contextQuery),
      );
      if (this.isStale(operation)) return { status: "stale" };

      const previewId = this.createPreviewId();
      if (!isCanonicalUuid(previewId)) {
        throw new DataExchangeApplicationError(
          "가져오기 미리보기 식별자를 만들 수 없습니다.",
          "invalid_response",
        );
      }
      const preview = buildImportPreview(prepared, context, previewId);
      this.currentPreview = preview;
      return { status: "ready", preview };
    } catch (error: unknown) {
      if (this.isStale(operation)) return { status: "stale" };
      throw safeError(error, "미리보기를 준비하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  async commit(input: unknown): Promise<ImportCommitOperation> {
    if (this.commitInFlight) throw busyError();
    const preview = this.currentPreview;
    if (preview === null) {
      throw new DataExchangeValidationError([
        { field: "preview", message: "먼저 가져올 파일을 선택해 주세요." },
      ]);
    }
    const request = buildImportCommitRequest(preview, input);
    const operation = ++this.sequence;
    this.commitInFlight = true;
    try {
      const parsedResult = parseImportCommitResult(await this.repository.commit(request));
      const result = validateImportCommitResult(parsedResult, request);
      if (this.isStale(operation)) return { status: "stale" };
      this.currentPreview = null;
      return { status: "completed", result };
    } catch (error: unknown) {
      if (this.isStale(operation)) return { status: "stale" };
      if (error instanceof DataExchangeError && error.code === "conflict") {
        this.currentPreview = null;
      }
      throw safeError(error, "계약을 반영하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      this.commitInFlight = false;
    }
  }

  clear(): void {
    this.sequence += 1;
    this.currentPreview = null;
  }

  private isStale(operation: number): boolean {
    return operation !== this.sequence;
  }
}

function safeError(error: unknown, message: string): DataExchangeError {
  return error instanceof DataExchangeError
    ? error
    : new DataExchangeApplicationError(message);
}

function busyError(): DataExchangeError {
  return new DataExchangeApplicationError(
    "진행 중인 가져오기가 끝날 때까지 기다려 주세요.",
    "busy",
  );
}

function isCanonicalUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}
