import type {
  ContractExportSaveOperation,
  ContractExportSummaryOperation,
} from "../application/contract-export-application";
import type { ContractExportUiPort } from "../components/contract-export-ui";
import type { ContractExportFormat } from "../types/contract-export";

export interface ContractExportPageApplication {
  loadSummary(): Promise<ContractExportSummaryOperation>;
  save(format: ContractExportFormat): Promise<ContractExportSaveOperation>;
  clear(): void;
}

export function createContractExportPagePort(
  application: ContractExportPageApplication,
): ContractExportUiPort {
  return {
    loadSummary: () => application.loadSummary(),
    save: (format) => application.save(format),
    clear: () => application.clear(),
  };
}
