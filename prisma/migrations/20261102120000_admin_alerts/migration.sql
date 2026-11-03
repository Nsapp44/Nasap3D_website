-- CreateEnum
CREATE TYPE "AdminAlertKind" AS ENUM ('LABEL_REFUSED', 'TRACKING_UNREACHABLE', 'PAYMENT_ANOMALY', 'EMAIL_FAILED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "labelManualAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AdminAlert" (
    "id" TEXT NOT NULL,
    "kind" "AdminAlertKind" NOT NULL,
    "key" TEXT NOT NULL,
    "orderId" TEXT,
    "orderRef" TEXT,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "AdminAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminAlert_key_key" ON "AdminAlert"("key");

-- CreateIndex
CREATE INDEX "AdminAlert_resolvedAt_idx" ON "AdminAlert"("resolvedAt");

-- AddForeignKey
ALTER TABLE "AdminAlert" ADD CONSTRAINT "AdminAlert_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
