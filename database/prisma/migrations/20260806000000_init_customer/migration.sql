-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "birth_date" TEXT,
    "gender" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "memo" TEXT,
    "status" TEXT,
    "is_managed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME
);

-- CreateIndex
CREATE INDEX "customers_deleted_at_idx" ON "customers"("deleted_at");

-- CreateIndex
CREATE INDEX "customers_name_deleted_at_idx" ON "customers"("name", "deleted_at");

-- CreateIndex
CREATE INDEX "customers_status_deleted_at_idx" ON "customers"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "customers_is_managed_deleted_at_idx" ON "customers"("is_managed", "deleted_at");
