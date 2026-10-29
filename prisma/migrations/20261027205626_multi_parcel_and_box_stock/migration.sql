-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingParcels" JSONB;

-- CreateTable
CREATE TABLE "ShippingBoxStock" (
    "code" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingBoxStock_pkey" PRIMARY KEY ("code")
);
