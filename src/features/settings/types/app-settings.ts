export type ThemeMode = "light" | "dark";

export const DEFAULT_RECENT_CONSULTATION_DAYS = 30;
export const DEFAULT_UNCONSULTED_DAYS = 90;
export const DEFAULT_DASHBOARD_ITEM_LIMIT = 10;

export const MIN_RECENT_CONSULTATION_DAYS = 1;
export const MAX_RECENT_CONSULTATION_DAYS = 365;
export const MIN_UNCONSULTED_DAYS = 1;
export const MAX_UNCONSULTED_DAYS = 3_650;

export interface AppSettingsInput {
  readonly theme: ThemeMode;
  readonly recentConsultationDays: number;
  readonly unconsultedDays: number;
  readonly dashboardItemLimit: number;
}

export interface BackupDirectoryDisplay {
  readonly kind: "default" | "custom";
  readonly basename: string | null;
}

export interface AppSettings extends AppSettingsInput {
  readonly backupDirectory: BackupDirectoryDisplay;
}

export const DEFAULT_APP_SETTINGS_INPUT: AppSettingsInput = {
  theme: "light",
  recentConsultationDays: DEFAULT_RECENT_CONSULTATION_DAYS,
  unconsultedDays: DEFAULT_UNCONSULTED_DAYS,
  dashboardItemLimit: DEFAULT_DASHBOARD_ITEM_LIMIT,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  ...DEFAULT_APP_SETTINGS_INPUT,
  backupDirectory: { kind: "default", basename: null },
};
