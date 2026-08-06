import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import {
  parseImportCommitRequest,
  parseImportCommitResult,
} from "../schemas/import-commit-schema";
import { parseParsedImportFile } from "../schemas/contract-source-schema";
import type { ImportCommitRequest, ImportCommitResult } from "../types/import-commit";
import type { ParsedImportFile } from "../types/contract-source";
import {
  DataExchangeError,
  DataExchangeRepositoryError,
} from "../types/data-exchange-error";
import type { DataExchangeRepository } from "./data-exchange-repository";

export type DataExchangeInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

const defaultInvoke: DataExchangeInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> => invoke<T>(command, args);

const commandErrorSchema = z.object({ code: z.string() }).passthrough();

export class TauriDataExchangeRepository implements DataExchangeRepository {
  constructor(private readonly invokeCommand: DataExchangeInvoke = defaultInvoke) {}

  async chooseFile(): Promise<ParsedImportFile | null> {
    return this.execute(async () => {
      const result = await this.invokeCommand<unknown>("choose_contract_import_file");
      return result === null ? null : parseParsedImportFile(result);
    });
  }

  async commit(request: ImportCommitRequest): Promise<ImportCommitResult> {
    const parsed = parseImportCommitRequest(request);
    return this.execute(async () =>
      parseImportCommitResult(
        await this.invokeCommand<unknown>("commit_contract_import", { request: parsed }),
      )
    );
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      throw dataExchangeRepositoryErrorFrom(error);
    }
  }
}

export function dataExchangeRepositoryErrorFrom(error: unknown): DataExchangeError {
  if (error instanceof DataExchangeError) return error;
  const code = decodeCommandError(error)?.code.toUpperCase() ?? "";
  if (code.includes("CONFLICT")) {
    return new DataExchangeRepositoryError(
      "데이터가 변경되었습니다. 파일을 다시 확인해 주세요.",
      "conflict",
    );
  }
  if (code.includes("TOO_LARGE") || code.includes("LIMIT")) {
    return new DataExchangeRepositoryError("선택한 파일이 가져오기 허용 범위를 넘었습니다.", "invalid_file");
  }
  if (code.includes("NO_DATA")) {
    return new DataExchangeRepositoryError("가져올 계약 행이 없습니다.", "invalid_file");
  }
  if (code.includes("SHEET") || code.includes("HEADER")) {
    return new DataExchangeRepositoryError("계약조회 sheet와 21개 열 순서를 확인해 주세요.", "invalid_file");
  }
  if (
    code.includes("FILE") || code.includes("XLSX") || code.includes("CSV") ||
    code.includes("ENCODING") || code.includes("SIGNATURE") ||
    code.includes("CELL_") || code.includes("EXTRA_COLUMN")
  ) {
    return new DataExchangeRepositoryError("선택한 .xlsx 또는 .csv 파일을 확인해 주세요.", "invalid_file");
  }
  if (code.includes("VALIDATION") || code.includes("INVALID")) {
    return new DataExchangeRepositoryError("가져오기 선택 내용을 확인해 주세요.", "invalid_selection");
  }
  return new DataExchangeRepositoryError();
}

function decodeCommandError(error: unknown): z.infer<typeof commandErrorSchema> | null {
  if (typeof error === "string") {
    try {
      return commandErrorSchema.safeParse(JSON.parse(error)).data ?? null;
    } catch {
      return commandErrorSchema.safeParse({ code: error }).data ?? null;
    }
  }
  return commandErrorSchema.safeParse(error).data ?? null;
}
