export const CONTRACT_EXPORT_FORMATS = ["xlsx", "csv"] as const;

export type ContractExportFormat = (typeof CONTRACT_EXPORT_FORMATS)[number];

export interface ContractExportSummary {
  readonly exportableCount: number;
  readonly missingSourceCount: number;
  readonly conflictCount: number;
  readonly csvAllowed: boolean;
}

export interface ContractExportResult {
  readonly basename: string;
  readonly format: ContractExportFormat;
  readonly exportedCount: number;
  readonly missingSourceCount: number;
  readonly conflictCount: number;
}
