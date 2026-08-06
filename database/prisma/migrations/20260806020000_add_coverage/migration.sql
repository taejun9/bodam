-- CreateTable
CREATE TABLE "coverage_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "coverages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policy_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "amount_won" BIGINT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "coverages_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "insurance_policies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "coverages_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "coverage_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "coverage_categories_deleted_at_name_idx" ON "coverage_categories"("deleted_at", "name");

-- CreateIndex
CREATE INDEX "coverages_policy_id_deleted_at_idx" ON "coverages"("policy_id", "deleted_at");

-- CreateIndex
CREATE INDEX "coverages_category_id_deleted_at_idx" ON "coverages"("category_id", "deleted_at");

-- SeedData
INSERT INTO "coverage_categories" ("id", "name") VALUES
    ('10000000-0000-4000-8000-000000000001', '암'),
    ('10000000-0000-4000-8000-000000000002', '유사암'),
    ('10000000-0000-4000-8000-000000000003', '뇌혈관'),
    ('10000000-0000-4000-8000-000000000004', '심혈관'),
    ('10000000-0000-4000-8000-000000000005', '질병수술'),
    ('10000000-0000-4000-8000-000000000006', '상해수술'),
    ('10000000-0000-4000-8000-000000000007', '후유장해'),
    ('10000000-0000-4000-8000-000000000008', '입원'),
    ('10000000-0000-4000-8000-000000000009', '간병'),
    ('10000000-0000-4000-8000-000000000010', '운전자');
