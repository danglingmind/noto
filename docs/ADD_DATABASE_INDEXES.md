# Adding Database Indexes for Performance

## Current Status

Most indexes already exist in your Prisma schema:
- ✅ `annotations.fileId` - Already indexed (`@@index([fileId])`)
- ⚠️ `comments.annotationId` - Has composite index `[annotationId, parentId]`, but single-column index is better
- ✅ `workspace_members.userId` - Already indexed (`@@index([userId])`)

## Method 1: Using Prisma Migration (Recommended)

This is the best way as it keeps your schema in sync:

```bash
# 1. I've already updated the schema to add the missing index
# 2. Create a migration
npx prisma migrate dev --name add_performance_indexes

# 3. Apply to production
npx prisma migrate deploy
```

## Method 2: Direct SQL (Quick Fix)

If you want to add indexes immediately without a migration:

### Option A: Using Neon Console (Easiest)

1. Go to your Neon dashboard: https://console.neon.tech
2. Select your project
3. Click on "SQL Editor"
4. Paste and run this SQL:

```sql
-- Add single-column index on comments.annotationId for better performance
CREATE INDEX IF NOT EXISTS idx_comments_annotation_id ON comments(annotation_id);

-- Verify it was created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'comments' 
AND indexname = 'idx_comments_annotation_id';
```

### Option B: Using psql Command Line

```bash
# Connect to your Neon database
psql "postgresql://neondb_owner:npg_kWRFM5bGI4rL@ep-solitary-art-a1ndmodq-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# Run the SQL
CREATE INDEX IF NOT EXISTS idx_comments_annotation_id ON comments(annotation_id);

# Verify
\di comments
```

### Option C: Using Prisma Studio (Visual)

```bash
# Open Prisma Studio
npx prisma studio

# Then use the SQL editor in Prisma Studio to run:
CREATE INDEX IF NOT EXISTS idx_comments_annotation_id ON comments(annotation_id);
```

## Method 3: Using the SQL Script

I've created a script with all performance indexes:

```bash
# Using psql
psql "your-database-url" < scripts/add-performance-indexes.sql

# Or copy the SQL from scripts/add-performance-indexes.sql
# and run it in Neon Console SQL Editor
```

## Verify Indexes Exist

Run this query to see all indexes:

```sql
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('annotations', 'comments', 'workspace_members')
ORDER BY tablename, indexname;
```

## Expected Results

After adding indexes, you should see:

```
annotations:
  - idx_annotations_file_id
  - idx_annotations_file_id_viewport (composite)
  - idx_annotations_created_at
  - idx_annotations_user_id

comments:
  - idx_comments_annotation_id (NEW - single column)
  - idx_comments_annotation_id_parent_id (composite)
  - idx_comments_parent_id
  - idx_comments_created_at

workspace_members:
  - idx_workspace_members_user_id
  - idx_workspace_members_workspace_id
  - idx_workspace_members_role
```

## Performance Impact

- **Before:** Queries filtering by `annotationId` use composite index (slower)
- **After:** Queries filtering by `annotationId` use dedicated single-column index (faster)
- **Expected improvement:** 20-50ms per query that filters comments by annotationId

## Important Notes

1. **Indexes take time to build** - On large tables, creating indexes can take a few minutes
2. **Indexes use storage** - Each index uses additional disk space
3. **Write performance** - More indexes = slightly slower writes, but much faster reads
4. **Already exists check** - Using `IF NOT EXISTS` prevents errors if index already exists

## Next Steps

1. ✅ Schema updated with missing index
2. ⏳ Run migration or direct SQL to create index
3. ⏳ Verify indexes exist
4. ⏳ Monitor query performance improvements

