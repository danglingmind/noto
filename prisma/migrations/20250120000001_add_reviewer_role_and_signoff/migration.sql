-- AlterEnum
-- Add REVIEWER role to Role enum
ALTER TYPE "public"."Role" ADD VALUE IF NOT EXISTS 'REVIEWER';

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."revision_signoffs" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "signedOffBy" TEXT NOT NULL,
    "signedOffAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "revision_signoffs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "revision_signoffs_fileId_key" ON "public"."revision_signoffs"("fileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "revision_signoffs_fileId_idx" ON "public"."revision_signoffs"("fileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "revision_signoffs_signedOffBy_idx" ON "public"."revision_signoffs"("signedOffBy");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "revision_signoffs_signedOffAt_idx" ON "public"."revision_signoffs"("signedOffAt");

-- AddForeignKey
ALTER TABLE "public"."revision_signoffs" ADD CONSTRAINT "revision_signoffs_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "public"."files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."revision_signoffs" ADD CONSTRAINT "revision_signoffs_signedOffBy_fkey" FOREIGN KEY ("signedOffBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;




