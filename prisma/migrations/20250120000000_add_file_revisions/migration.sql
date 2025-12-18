-- Add parentFileId column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'files' 
        AND column_name = 'parentFileId'
    ) THEN
        ALTER TABLE "public"."files" ADD COLUMN "parentFileId" TEXT;
    END IF;
END $$;

-- Add revisionNumber column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'files' 
        AND column_name = 'revisionNumber'
    ) THEN
        ALTER TABLE "public"."files" ADD COLUMN "revisionNumber" INTEGER NOT NULL DEFAULT 1;
    END IF;
END $$;

-- Add isRevision column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'files' 
        AND column_name = 'isRevision'
    ) THEN
        ALTER TABLE "public"."files" ADD COLUMN "isRevision" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- CreateIndex if it doesn't exist
CREATE INDEX IF NOT EXISTS "files_parentFileId_idx" ON "public"."files"("parentFileId");

-- AddForeignKey if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'files_parentFileId_fkey'
    ) THEN
        ALTER TABLE "public"."files" ADD CONSTRAINT "files_parentFileId_fkey" 
            FOREIGN KEY ("parentFileId") REFERENCES "public"."files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Set all existing files to revisionNumber 1 and isRevision false (only if needed)
UPDATE "public"."files" 
SET "revisionNumber" = COALESCE("revisionNumber", 1), 
    "isRevision" = COALESCE("isRevision", false) 
WHERE "revisionNumber" IS NULL OR "isRevision" IS NULL;

