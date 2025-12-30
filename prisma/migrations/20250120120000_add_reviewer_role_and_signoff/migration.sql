-- Add REVIEWER to Role enum if not exists
-- Note: PostgreSQL doesn't support IF NOT EXISTS for ALTER TYPE ADD VALUE
-- So we check if it exists first
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'REVIEWER' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
    ) THEN
        ALTER TYPE "Role" ADD VALUE 'REVIEWER';
    END IF;
END $$;

-- Create revision_signoffs table if not exists
CREATE TABLE IF NOT EXISTS "revision_signoffs" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "signedOffBy" TEXT NOT NULL,
    "signedOffAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "revision_signoffs_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint if not exists
-- Handle case where it might exist as either constraint or index
DO $$ 
BEGIN
    -- Check if constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'revision_signoffs_fileId_key'
    ) THEN
        -- Check if unique index exists (unique indexes can serve as constraints)
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'revision_signoffs_fileId_key'
            AND schemaname = 'public'
        ) THEN
            BEGIN
                ALTER TABLE "revision_signoffs" ADD CONSTRAINT "revision_signoffs_fileId_key" UNIQUE ("fileId");
            EXCEPTION WHEN duplicate_object THEN
                -- Constraint already exists, ignore
                NULL;
            END;
        END IF;
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS "revision_signoffs_fileId_idx" ON "revision_signoffs"("fileId");
CREATE INDEX IF NOT EXISTS "revision_signoffs_signedOffBy_idx" ON "revision_signoffs"("signedOffBy");
CREATE INDEX IF NOT EXISTS "revision_signoffs_signedOffAt_idx" ON "revision_signoffs"("signedOffAt");

-- Add foreign keys if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'revision_signoffs_fileId_fkey'
    ) THEN
        ALTER TABLE "revision_signoffs" ADD CONSTRAINT "revision_signoffs_fileId_fkey" 
            FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'revision_signoffs_signedOffBy_fkey'
    ) THEN
        ALTER TABLE "revision_signoffs" ADD CONSTRAINT "revision_signoffs_signedOffBy_fkey" 
            FOREIGN KEY ("signedOffBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

