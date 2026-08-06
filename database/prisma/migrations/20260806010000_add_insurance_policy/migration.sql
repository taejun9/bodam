-- CreateTable
CREATE TABLE "insurance_policies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT NOT NULL,
    "insurer" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "joined_on" TEXT,
    "coverage_term" TEXT,
    "payment_term" TEXT,
    "monthly_premium_won" BIGINT NOT NULL,
    "disclosure_plan" TEXT,
    "matures_on" TEXT,
    "renewable" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "is_included" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "insurance_policies_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "insurance_policies_customer_id_deleted_at_idx" ON "insurance_policies"("customer_id", "deleted_at");

-- CreateIndex
CREATE INDEX "insurance_policies_matures_on_deleted_at_idx" ON "insurance_policies"("matures_on", "deleted_at");
