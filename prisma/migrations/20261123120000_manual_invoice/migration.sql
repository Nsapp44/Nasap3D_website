-- CreateTable
CREATE TABLE "ManualInvoice" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "dailySeq" INTEGER NOT NULL,
    "clientName" TEXT NOT NULL,
    "billingAddress" TEXT NOT NULL,
    "deliveryAddress" TEXT,
    "clientEmail" TEXT,
    "items" JSONB NOT NULL,
    "note" TEXT,
    "totalCents" INTEGER NOT NULL,
    "pdfKey" TEXT,
    "sentAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManualInvoice_ref_key" ON "ManualInvoice"("ref");
