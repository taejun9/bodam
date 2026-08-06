import { DataExchangeApplication } from "@/features/data-exchange/application/data-exchange-application";
import { ContractExportApplication } from "@/features/data-exchange/application/contract-export-application";
import { TauriContractExportRepository } from "@/features/data-exchange/repositories/tauri-contract-export-repository";
import { TauriDataExchangeRepository } from "@/features/data-exchange/repositories/tauri-data-exchange-repository";
import { TauriImportContextReader } from "@/features/data-exchange/repositories/tauri-import-context-reader";

export const dataExchangeApplication = new DataExchangeApplication(
  new TauriDataExchangeRepository(),
  new TauriImportContextReader(),
);

export const contractExportApplication = new ContractExportApplication(
  new TauriContractExportRepository(),
);
