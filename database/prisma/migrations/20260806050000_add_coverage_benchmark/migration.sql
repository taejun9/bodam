-- CreateTable
CREATE TABLE "coverage_benchmarks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category_id" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "min_age_years" INTEGER NOT NULL,
    "max_age_years" INTEGER NOT NULL,
    "adequate_min_won" BIGINT NOT NULL,
    "excessive_min_won" BIGINT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "coverage_benchmarks_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "coverage_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "coverage_benchmarks_deleted_at_category_id_gender_min_age_years_max_age_years_idx" ON "coverage_benchmarks"("deleted_at", "category_id", "gender", "min_age_years", "max_age_years");
