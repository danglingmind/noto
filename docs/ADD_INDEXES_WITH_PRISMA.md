# Adding Database Indexes with Prisma

Yes! You can use `prisma db push` to create indexes. I've updated the Prisma schema with all the necessary indexes.

## Indexes Added to Schema

### 1. Comments Model
- ✅ `@@index([annotationId])` - Single-column index for filtering comments by annotation
- ✅ `@@index([annotationId, parentId])` - Already existed (composite)
- ✅ `@@index([parentId])` - Already existed

### 2. Annotations Model  
- ✅ `@@index([fileId, updatedAt(sort: Desc)])` - Composite index for recent files sorting
- ✅ `@@index([fileId])` - Already existed
- ✅ `@@index([fileId, viewport])` - Already existed

### 3. Files Model
- ✅ `@@index([parentFileId])` - Already existed (for revisions queries)

## Apply Indexes

Simply run:

```bash
npx prisma db push
```

This will:
1. Compare your schema with the database
2. Create any missing indexes
3. Update the database to match your schema
4. **NOT** delete any data (safe to run)

## Verify Indexes Were Created

After running `prisma db push`, verify in Neon Console:

```sql
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND (
        tablename = 'comments' AND indexname LIKE '%annotation%'
        OR tablename = 'annotations' AND indexname LIKE '%file%'
        OR tablename = 'files' AND indexname LIKE '%parent%'
    )
ORDER BY tablename, indexname;
```

You should see:
- `comments`: `idx_comments_annotation_id` (or similar)
- `annotations`: `idx_annotations_file_id_updated_at` (or similar)
- `files`: `idx_files_parent_file_id` (or similar)

## Alternative: Use Prisma Migrate

If you prefer migrations (better for production):

```bash
# Create a migration
npx prisma migrate dev --name add_performance_indexes

# Apply to production
npx prisma migrate deploy
```

However, since you have migration drift, `prisma db push` is the safer option right now.

## What `prisma db push` Does

- ✅ Creates missing indexes
- ✅ Updates existing indexes if changed
- ✅ Does NOT delete data
- ✅ Does NOT delete existing indexes (unless removed from schema)
- ✅ Safe to run multiple times

## After Running

1. **Verify indexes exist:**
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE tablename IN ('comments', 'annotations', 'files')
   ORDER BY tablename, indexname;
   ```

2. **Test performance:**
   - Recent files API should be much faster
   - Revisions API should be much faster

3. **Deploy to Fly.io:**
   ```bash
   flyctl deploy
   ```

## Notes

- `prisma db push` is perfect for development and when you have migration drift
- It's safe to run - won't delete data
- For production, consider fixing migration history later and using `prisma migrate`

