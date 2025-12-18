# Production Migration Steps for Vercel

## Current Situation

Your database schema has been applied directly using `prisma db push`, which means migrations are not in sync with your database. The `revision_signoffs` table and `REVIEWER` role already exist in production.

## Quick Start: Apply Migrations to Production

### Option A: Baseline Existing Schema (Recommended)

Since your schema is already in production, you need to baseline it:

1. **Pull environment variables from Vercel:**
   ```bash
   vercel env pull .env.local
   ```

2. **Mark existing migrations as applied:**
   ```bash
   # Check migration status
   npx prisma migrate status
   
   # Mark migrations as applied (if they match your current schema)
   npx prisma migrate resolve --applied <migration_name>
   ```

3. **Create a new migration for the signoff feature:**
   ```bash
   npx prisma migrate dev --name add_reviewer_role_and_signoff --create-only
   ```

4. **Review the generated migration SQL** in `prisma/migrations/[timestamp]_add_reviewer_role_and_signoff/migration.sql`

5. **If the migration is empty or only has changes you've already applied**, you can either:
   - Delete the migration folder and use `db push` for now
   - Or create a manual migration that matches your current schema

### Option B: Use db push (Quick Fix - Not Recommended for Production)

If you want to quickly sync without migrations:

```bash
# Pull Vercel env vars
vercel env pull .env.local

# Push schema directly
npx prisma db push --accept-data-loss
```

⚠️ **Warning:** This is not recommended for production as it doesn't create migration history.

---

## Recommended Approach: Set Up Proper Migrations

### Step 1: Baseline Your Current Production Schema

1. **Create a baseline migration:**
   ```bash
   npx prisma migrate dev --name baseline_production_schema --create-only
   ```

2. **Edit the migration file** to only include the `revision_signoffs` table and `REVIEWER` role if they're missing:

   ```sql
   -- Add REVIEWER to Role enum if not exists
   ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'REVIEWER';

   -- Create revision_signoffs table if not exists
   CREATE TABLE IF NOT EXISTS "revision_signoffs" (
       "id" TEXT NOT NULL,
       "fileId" TEXT NOT NULL,
       "signedOffBy" TEXT NOT NULL,
       "signedOffAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "notes" TEXT,
       
       CONSTRAINT "revision_signoffs_pkey" PRIMARY KEY ("id"),
       CONSTRAINT "revision_signoffs_fileId_key" UNIQUE ("fileId")
   );

   -- Add indexes
   CREATE INDEX IF NOT EXISTS "revision_signoffs_fileId_idx" ON "revision_signoffs"("fileId");
   CREATE INDEX IF NOT EXISTS "revision_signoffs_signedOffBy_idx" ON "revision_signoffs"("signedOffBy");
   CREATE INDEX IF NOT EXISTS "revision_signoffs_signedOffAt_idx" ON "revision_signoffs"("signedOffAt");

   -- Add foreign keys
   ALTER TABLE "revision_signoffs" ADD CONSTRAINT "revision_signoffs_fileId_fkey" 
       FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
   ALTER TABLE "revision_signoffs" ADD CONSTRAINT "revision_signoffs_signedOffBy_fkey" 
       FOREIGN KEY ("signedOffBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
   ```

3. **Mark as applied** (since it already exists):
   ```bash
   npx prisma migrate resolve --applied baseline_production_schema
   ```

### Step 2: Configure Vercel to Run Migrations

Update your `package.json` build script:

```json
{
  "scripts": {
    "build": "prisma migrate deploy && prisma generate && next build --turbopack"
  }
}
```

Or use the migration script:

```json
{
  "scripts": {
    "build": "npm run db:migrate:prod && next build --turbopack"
  }
}
```

### Step 3: Ensure Environment Variables in Vercel

Make sure these are set in Vercel:
- `DATABASE_URL` - Your Prisma Accelerate connection string
- `DIRECT_URL` - Your direct PostgreSQL connection string (required for migrations)

### Step 4: Deploy

Push your changes and Vercel will automatically run migrations during build.

---

## Manual Migration (If Needed)

If you need to run migrations manually:

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login and link:**
   ```bash
   vercel login
   vercel link
   ```

3. **Pull environment variables:**
   ```bash
   vercel env pull .env.local
   ```

4. **Run migrations:**
   ```bash
   npm run db:migrate:prod
   # Or directly:
   npx prisma migrate deploy
   ```

---

## Verify Migration Status

Check which migrations have been applied:

```bash
npx prisma migrate status
```

This will show you:
- ✅ Applied migrations
- ⏳ Pending migrations
- ❌ Failed migrations

---

## Troubleshooting

### Error: "Migration failed: P3005"

**Solution:** Database schema is out of sync. You may need to:
1. Check if the migration SQL matches your current schema
2. Use `prisma migrate resolve --applied <migration>` if the changes are already applied
3. Or manually fix the migration SQL

### Error: "DIRECT_URL is required"

**Solution:** Make sure `DIRECT_URL` is set in your Vercel environment variables. This should be your direct PostgreSQL connection string (not Prisma Accelerate).

### Error: "Migration already applied"

**Solution:** Use `prisma migrate resolve --applied <migration>` to mark it as applied.

---

## Next Steps

1. ✅ Fix build errors (already done)
2. ⏳ Baseline your production schema
3. ⏳ Configure Vercel build to run migrations
4. ⏳ Test migrations locally first
5. ⏳ Deploy to production

For detailed information, see `docs/VERCEL_MIGRATIONS_GUIDE.md`.

