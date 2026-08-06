-- CreateTable
CREATE TABLE "families" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "family_memberships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "family_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "relationship_name" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "family_memberships_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "family_memberships_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "families_deleted_at_name_idx" ON "families"("deleted_at", "name");

-- CreateIndex
CREATE UNIQUE INDEX "family_memberships_family_id_customer_id_key" ON "family_memberships"("family_id", "customer_id");

-- CreateIndex
CREATE INDEX "family_memberships_family_id_deleted_at_idx" ON "family_memberships"("family_id", "deleted_at");

-- CreateIndex
CREATE INDEX "family_memberships_customer_id_deleted_at_idx" ON "family_memberships"("customer_id", "deleted_at");
