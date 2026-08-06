import type {
  ContractExportFormat,
  ContractExportResult,
  ContractExportSummary,
} from "../types/contract-export";

export type ContractExportUiSummary = ContractExportSummary;
export type ContractExportUiResult = ContractExportResult;

export type ContractExportUiSummaryOperation =
  | { readonly status: "ready"; readonly summary: ContractExportUiSummary }
  | { readonly status: "stale" };

export type ContractExportUiSaveOperation =
  | { readonly status: "completed"; readonly result: ContractExportUiResult }
  | { readonly status: "cancelled" }
  | { readonly status: "stale" };

export interface ContractExportUiPort {
  readonly loadSummary: () => Promise<ContractExportUiSummaryOperation>;
  readonly save: (
    format: ContractExportFormat,
  ) => Promise<ContractExportUiSaveOperation>;
  readonly clear?: () => void;
}
