-- RedefineTable
CREATE TABLE "new_app_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "recent_consultation_days" INTEGER NOT NULL DEFAULT 30,
    "unconsulted_days" INTEGER NOT NULL DEFAULT 90,
    "dashboard_item_limit" INTEGER NOT NULL DEFAULT 10,
    "custom_backup_directory" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_settings_singleton_check" CHECK ("id" = 1),
    CONSTRAINT "app_settings_theme_check" CHECK ("theme" IN ('light', 'dark', 'system')),
    CONSTRAINT "app_settings_recent_days_check" CHECK ("recent_consultation_days" BETWEEN 1 AND 365),
    CONSTRAINT "app_settings_unconsulted_days_check" CHECK ("unconsulted_days" BETWEEN 1 AND 3650),
    CONSTRAINT "app_settings_period_order_check" CHECK ("unconsulted_days" >= "recent_consultation_days"),
    CONSTRAINT "app_settings_item_limit_check" CHECK ("dashboard_item_limit" BETWEEN 1 AND 10),
    CONSTRAINT "app_settings_backup_directory_check" CHECK ("custom_backup_directory" IS NULL OR length("custom_backup_directory") > 0)
);

INSERT INTO "new_app_settings" (
    "id",
    "theme",
    "recent_consultation_days",
    "unconsulted_days",
    "dashboard_item_limit",
    "custom_backup_directory",
    "created_at",
    "updated_at"
)
SELECT
    "id",
    "theme",
    "recent_consultation_days",
    "unconsulted_days",
    "dashboard_item_limit",
    "custom_backup_directory",
    "created_at",
    "updated_at"
FROM "app_settings";

DROP TABLE "app_settings";
ALTER TABLE "new_app_settings" RENAME TO "app_settings";
