-- Real shipping-label purchase (Boxtal api/v1/order) — see boxtal.ts's
-- purchaseShippingLabel(). boxtalOrderRef is unique and doubles as the
-- anti-double-purchase guard (real money is spent when this is set).
ALTER TABLE "Order" ADD COLUMN "boxtalOrderRef" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingLabelUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN "labelPurchasedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Order_boxtalOrderRef_key" ON "Order"("boxtalOrderRef");
