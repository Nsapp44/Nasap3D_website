-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PRINTING', 'READY', 'DELIVERED');

-- CreateEnum
CREATE TYPE "QuoteJobStatus" AS ENUM ('DRAFT', 'ANALYZED', 'EXPIRED', 'CONVERTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "customerNo" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "densityGCm3" DOUBLE PRECISION NOT NULL,
    "pricePerKgCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialColor" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "inStock" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MaterialColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityProfile" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "layerHeightMm" DOUBLE PRECISION NOT NULL,
    "timeMultiplier" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "QualityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountTier" (
    "id" TEXT NOT NULL,
    "minQty" INTEGER NOT NULL,
    "pct" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DiscountTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "quoteEnabled" BOOLEAN NOT NULL DEFAULT true,
    "hourlyRateCents" INTEGER NOT NULL,
    "marginPct" DOUBLE PRECISION NOT NULL,
    "setupFeeCents" INTEGER NOT NULL,
    "quoteExpiryMinutes" INTEGER NOT NULL DEFAULT 60,
    "recaptchaMinScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "QuoteJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "materialId" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "qualityId" TEXT NOT NULL,
    "infillPct" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "volumeCm3" DOUBLE PRECISION,
    "bboxXMm" DOUBLE PRECISION,
    "bboxYMm" DOUBLE PRECISION,
    "bboxZMm" DOUBLE PRECISION,
    "weightG" DOUBLE PRECISION,
    "estimatedTimeMin" DOUBLE PRECISION,
    "unitPriceCents" INTEGER,
    "totalPriceCents" INTEGER,
    "status" "QuoteJobStatus" NOT NULL DEFAULT 'DRAFT',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "quoteJobId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "stripePaymentIntentId" TEXT,
    "printingAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "quoteJobId" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "materialSnapshot" TEXT NOT NULL,
    "colorNameSnapshot" TEXT NOT NULL,
    "colorHexSnapshot" TEXT NOT NULL,
    "infillSnapshot" INTEGER NOT NULL,
    "qualitySnapshot" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "lineTotalCents" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "pdfKey" TEXT NOT NULL,
    "dailySeq" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "fileKey" TEXT,
    "recaptchaScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_customerNo_key" ON "User"("customerNo");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Material_key_key" ON "Material"("key");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialColor_materialId_colorName_key" ON "MaterialColor"("materialId", "colorName");

-- CreateIndex
CREATE UNIQUE INDEX "QualityProfile_key_key" ON "QualityProfile"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountTier_minQty_key" ON "DiscountTier"("minQty");

-- CreateIndex
CREATE INDEX "QuoteJob_userId_idx" ON "QuoteJob"("userId");

-- CreateIndex
CREATE INDEX "QuoteJob_sessionId_idx" ON "QuoteJob"("sessionId");

-- CreateIndex
CREATE INDEX "CartItem_userId_idx" ON "CartItem"("userId");

-- CreateIndex
CREATE INDEX "CartItem_sessionId_idx" ON "CartItem"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_ref_key" ON "Order"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripePaymentIntentId_key" ON "Order"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_ref_key" ON "Invoice"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialColor" ADD CONSTRAINT "MaterialColor_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteJob" ADD CONSTRAINT "QuoteJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteJob" ADD CONSTRAINT "QuoteJob_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteJob" ADD CONSTRAINT "QuoteJob_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "MaterialColor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteJob" ADD CONSTRAINT "QuoteJob_qualityId_fkey" FOREIGN KEY ("qualityId") REFERENCES "QualityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quoteJobId_fkey" FOREIGN KEY ("quoteJobId") REFERENCES "QuoteJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quoteJobId_fkey" FOREIGN KEY ("quoteJobId") REFERENCES "QuoteJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

