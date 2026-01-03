# Fly.io Performance Optimizations

## Summary

This document outlines the performance optimizations applied to improve app performance on Fly.io.

## Issues Identified

1. **Cold Starts** - Machines were stopping when idle (`min_machines_running = 0`), causing 2-5 second delays on first request
2. **Limited Resources** - Only 1GB RAM and 1 CPU was insufficient for Next.js production workloads
3. **No Compression** - Responses weren't being compressed, increasing bandwidth and load times
4. **Suboptimal Connection Pooling** - Database connection limits weren't optimized for Neon

## Optimizations Applied

### 1. ✅ Fixed Cold Starts (`fly.toml`)

**Before:**
```toml
auto_stop_machines = 'stop'
min_machines_running = 0
```

**After:**
```toml
auto_stop_machines = 'suspend'  # Suspend instead of stop (faster wake-up)
min_machines_running = 1        # Keep at least 1 machine running
```

**Impact:** Eliminates cold start delays. Machines now suspend (faster wake-up) instead of stopping, and at least 1 machine stays running.

### 2. ✅ Increased VM Resources (`fly.toml`)

**Before:**
```toml
memory = '1gb'
cpus = 1
```

**After:**
```toml
memory = '2gb'
cpus = 2
```

**Impact:** 
- More memory for Next.js runtime and caching
- 2 CPUs allow better parallel processing
- Reduces memory pressure and improves response times

### 3. ✅ Next.js Performance Optimizations (`next.config.ts`)

**Added:**
- `compress: true` - Enables gzip/brotli compression
- `swcMinify: true` - Uses SWC for faster minification
- `poweredByHeader: false` - Removes X-Powered-By header
- Image optimization with AVIF/WebP support
- Image caching with 60s minimum TTL

**Impact:** 
- Smaller response sizes (30-70% reduction)
- Faster builds
- Better image loading performance

### 4. ✅ Optimized Database Connection Pooling (`src/lib/prisma.ts`)

**Before:**
```typescript
connection_limit=20&pool_timeout=30&connect_timeout=30
```

**After:**
```typescript
connection_limit=10&pool_timeout=20&connect_timeout=10&pgbouncer=true
```

**Impact:**
- Lower connection limit (10) is optimal for Neon's connection pooling
- Faster connection establishment (10s vs 30s timeout)
- Enables pgBouncer for better connection management

## Expected Performance Improvements

1. **Cold Starts:** Eliminated (was 2-5 seconds, now 0)
2. **Response Times:** 30-50% faster due to:
   - More CPU/memory resources
   - Response compression
   - Better connection pooling
3. **Throughput:** 2x improvement with 2 CPUs
4. **Memory Usage:** More headroom reduces garbage collection pauses

## Additional Recommendations

### 1. Use Neon Connection Pooling (Recommended)

Neon provides built-in connection pooling. Consider using their pooled connection string:

```env
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"
```

This provides:
- Built-in connection pooling
- Better performance
- Automatic failover

### 2. Monitor Performance

Use Fly.io metrics to monitor:
- Response times
- Memory usage
- CPU utilization
- Request rates

```bash
flyctl metrics
```

### 3. Consider Multi-Region Deployment

If you have users in multiple regions, consider deploying to multiple regions:

```toml
[[services]]
  # ... existing config ...

[[services.regions]]
  code = "iad"  # Primary region

[[services.regions]]
  code = "lhr"  # London (if you have EU users)
```

### 4. Enable Fly.io Edge Caching

For static assets, consider using Fly.io's edge caching or a CDN like Cloudflare.

### 5. Database Query Optimization

While Neon queries are fast, ensure your queries are optimized:
- Use indexes on frequently queried columns
- Avoid N+1 queries
- Use Prisma's `select` to fetch only needed fields
- Consider using Prisma Accelerate for query caching

## Deployment

After making these changes, redeploy:

```bash
flyctl deploy
```

Monitor the deployment and check metrics:

```bash
flyctl status
flyctl metrics
```

## Cost Impact

- **Before:** ~$5-10/month (1GB RAM, 1 CPU, auto-stop)
- **After:** ~$15-25/month (2GB RAM, 2 CPUs, always-on)
- **Trade-off:** Slightly higher cost for significantly better performance

## Verification

After deployment, verify improvements:

1. Check response times: `flyctl metrics`
2. Test cold starts: Wait 5 minutes, then make a request
3. Monitor memory usage: Should stay under 1.5GB
4. Check database connections: Should use 5-10 connections max

## Troubleshooting

If performance is still slow:

1. **Check region:** Ensure Fly.io region matches Neon region
2. **Check logs:** `flyctl logs` for errors or slow queries
3. **Database:** Verify Neon connection pooling is enabled
4. **Memory:** Monitor for memory leaks or excessive usage
5. **Network:** Check latency between Fly.io and Neon

