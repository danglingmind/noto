-- AlterTable
ALTER TABLE "public"."files" ADD COLUMN     "parentFileId" TEXT,
ADD COLUMN     "revisionNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "isRevision" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "files_parentFileId_idx" ON "public"."files"("parentFileId");

-- AddForeignKey
ALTER TABLE "public"."files" ADD CONSTRAINT "files_parentFileId_fkey" FOREIGN KEY ("parentFileId") REFERENCES "public"."files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Set all existing files to revisionNumber 1 and isRevision false
UPDATE "public"."files" SET "revisionNumber" = 1, "isRevision" = false WHERE "revisionNumber" IS NULL OR "isRevision" IS NULL;

