-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "QuoteJob" DROP COLUMN "expiresAt";

-- AlterTable
ALTER TABLE "Settings" DROP COLUMN "quoteExpiryMinutes";
