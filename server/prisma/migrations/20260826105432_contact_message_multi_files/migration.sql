-- Several attachments per contact message instead of one. No data to
-- preserve at the time this was written (checked: 0 of 3 existing
-- ContactMessage rows had a fileKey set), so this is a plain
-- drop-and-create rather than a backfill migration.

-- AlterTable
ALTER TABLE "ContactMessage" DROP COLUMN "fileKey",
DROP COLUMN "fileName";

-- CreateTable
CREATE TABLE "ContactMessageFile" (
    "id" TEXT NOT NULL,
    "contactMessageId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,

    CONSTRAINT "ContactMessageFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactMessageFile_contactMessageId_idx" ON "ContactMessageFile"("contactMessageId");

-- AddForeignKey
ALTER TABLE "ContactMessageFile" ADD CONSTRAINT "ContactMessageFile_contactMessageId_fkey" FOREIGN KEY ("contactMessageId") REFERENCES "ContactMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
