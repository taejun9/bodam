import { invoke } from "@tauri-apps/api/core";

import {
  parseImportContextQuery,
  parseImportContextSnapshot,
} from "../schemas/import-context-schema";
import type {
  ImportContextQuery,
  ImportContextSnapshot,
} from "../types/import-preview";
import type { ImportContextReader } from "./data-exchange-repository";
import {
  dataExchangeRepositoryErrorFrom,
  type DataExchangeInvoke,
} from "./tauri-data-exchange-repository";

const defaultInvoke: DataExchangeInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> => invoke<T>(command, args);

export class TauriImportContextReader implements ImportContextReader {
  constructor(private readonly invokeCommand: DataExchangeInvoke = defaultInvoke) {}

  async load(query: ImportContextQuery): Promise<ImportContextSnapshot> {
    const parsed = parseImportContextQuery(query);
    try {
      return parseImportContextSnapshot(
        await this.invokeCommand<unknown>("load_contract_import_context", {
          query: parsed,
        }),
      );
    } catch (error: unknown) {
      throw dataExchangeRepositoryErrorFrom(error);
    }
  }
}
