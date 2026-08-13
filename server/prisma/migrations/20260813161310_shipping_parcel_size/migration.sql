-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingOversized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shippingParcelHeightCm" INTEGER,
ADD COLUMN     "shippingParcelLengthCm" INTEGER,
ADD COLUMN     "shippingParcelWidthCm" INTEGER;
