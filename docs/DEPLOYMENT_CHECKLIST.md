# Performance Optimization Deployment Checklist

## Pre-Deployment

- [x] Region changed to Singapore (sin) in fly.toml
- [x] Recent files API optimized (N+1 query fixed)
- [x] Revisions API optimized (OR query → UNION)
- [x] Workspaces API optimized (parallel queries, limits)
- [x] Database indexes SQL script created

## Deployment Steps

### 1. Add Database Indexes (Do First)

**Option A: Neon Console (Recommended)**
1. Go to https://console.neon.tech
2. Open SQL Editor
3. Copy contents of `scripts/add-performance-indexes.sql`
4. Paste and run

**Option B: Command Line**
```bash
psql "your-database-url" < scripts/add-performance-indexes.sql
```

**Verify indexes:**
```sql
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('files', 'annotations', 'comments')
AND indexname LIKE 'idx_%';
```

### 2. Deploy to Fly.io

```bash
# Deploy with new region
flyctl deploy

# Verify deployment
flyctl status

# Check region
flyctl regions list
# Should show 'sin' as primary region
```

### 3. Verify Performance

Test each API endpoint:
- [ ] `/api/workspaces/[id]/recent-files` - Should be < 500ms
- [ ] `/api/files/[id]/revisions` - Should be < 500ms
- [ ] `/api/workspaces/[id]` - Should be < 500ms
- [ ] `/api/workspaces/[id]/access` - Should be < 500ms
- [ ] `/api/user/me` - Should be < 500ms
- [ ] `/api/files/[id]/signoff` - Should be < 500ms

### 4. Monitor

```bash
# Check Fly.io metrics
flyctl metrics

# Check logs for errors
flyctl logs

# Monitor database performance in Neon dashboard
```

## Expected Results

| API Route | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Recent Files | 12s | < 500ms | 96% |
| Revisions | 17s | < 500ms | 97% |
| Workspaces | 4s | < 500ms | 88% |
| Access | 6s | < 500ms | 92% |
| User/Me | 6s | < 500ms | 92% |
| Signoff | 7s | < 500ms | 93% |

## Troubleshooting

If performance is still slow:

1. **Verify region match:**
   ```bash
   flyctl regions list
   # Should show 'sin'
   ```

2. **Check database indexes:**
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE indexname LIKE 'idx_files_parent%' 
   OR indexname LIKE 'idx_annotations_file%';
   ```

3. **Check database connection:**
   - Verify using connection pooler URL
   - Check connection string in environment variables

4. **Monitor slow queries:**
   - Enable query logging in Neon
   - Check for missing indexes

## Rollback Plan

If issues occur:

1. **Revert region:**
   ```bash
   # Edit fly.toml
   primary_region = 'iad'
   
   # Redeploy
   flyctl deploy
   ```

2. **Revert code changes:**
   ```bash
   git revert <commit-hash>
   flyctl deploy
   ```

