import type {
  ContractExportFormat,
  ContractExportResult,
  ContractExportSummary,
} from "../types/contract-export";

export interface ContractExportRepository {
  loadSummary(): Promise<ContractExportSummary>;
  save(format: ContractExportFormat): Promise<ContractExportResult | null>;
}
