-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer_id" TEXT,
    "title" TEXT NOT NULL,
    "scheduled_on" TEXT NOT NULL,
    "scheduled_time" TEXT,
    "memo" TEXT,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "schedules_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "schedules_scheduled_on_deleted_at_idx" ON "schedules"("scheduled_on", "deleted_at");

-- CreateIndex
CREATE INDEX "schedules_customer_id_deleted_at_idx" ON "schedules"("customer_id", "deleted_at");
