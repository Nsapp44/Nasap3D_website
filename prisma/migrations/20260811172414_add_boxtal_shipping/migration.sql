-- CreateEnum
CREATE TYPE "ShippingMode" AS ENUM ('RELAY', 'HOME');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "recipientAddress" TEXT,
ADD COLUMN     "recipientCity" TEXT,
ADD COLUMN     "recipientCountry" TEXT,
ADD COLUMN     "recipientName" TEXT,
ADD COLUMN     "recipientPhone" TEXT,
ADD COLUMN     "recipientZipcode" TEXT,
ADD COLUMN     "relayPointAddress" TEXT,
ADD COLUMN     "relayPointCity" TEXT,
ADD COLUMN     "relayPointCode" TEXT,
ADD COLUMN     "relayPointName" TEXT,
ADD COLUMN     "relayPointZipcode" TEXT,
ADD COLUMN     "shippingCarrierCode" TEXT,
ADD COLUMN     "shippingCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shippingLabel" TEXT,
ADD COLUMN     "shippingMode" "ShippingMode",
ADD COLUMN     "shippingServiceCode" TEXT,
ADD COLUMN     "shippingWeightG" DOUBLE PRECISION;
