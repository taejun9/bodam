import type { ImportCommitRequest, ImportCommitResult } from "../types/import-commit";
import type { ParsedImportFile } from "../types/contract-source";
import type { ImportContextQuery, ImportContextSnapshot } from "../types/import-preview";

export interface DataExchangeRepository {
  chooseFile(): Promise<ParsedImportFile | null>;
  commit(request: ImportCommitRequest): Promise<ImportCommitResult>;
}

export interface ImportContextReader {
  load(query: ImportContextQuery): Promise<ImportContextSnapshot>;
}
