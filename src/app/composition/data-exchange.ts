import { DataExchangeApplication } from "@/features/data-exchange/application/data-exchange-application";
import { TauriDataExchangeRepository } from "@/features/data-exchange/repositories/tauri-data-exchange-repository";
import { TauriImportContextReader } from "@/features/data-exchange/repositories/tauri-import-context-reader";

export const dataExchangeApplication = new DataExchangeApplication(
  new TauriDataExchangeRepository(),
  new TauriImportContextReader(),
);
