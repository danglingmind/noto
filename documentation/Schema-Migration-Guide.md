# Schema Migration Guide: Advanced Annotation Features

This document outlines the database schema changes implemented to support the advanced annotation system described in the annotation process document.

## Overview

The migration adds support for:
- Enhanced annotation targeting with W3C-style selectors
- Website snapshot processing with async status tracking
- Rich metadata structures for different file types
- Backward compatibility with existing annotation data

## Schema Changes

### 1. Files Table Enhancements

**New Fields:**
- `status` (FileStatus): Tracks processing state for async operations
- `updatedAt` (DateTime): Automatic timestamp updates

**New Enum:**
```sql
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'READY', 'FAILED');
```

**Enhanced Metadata Structure:**
- **IMAGE**: `{ intrinsic: { width: number, height: number } }`
- **PDF**: `{ pages: [{ width: number, height: number }, ...] }`
- **VIDEO**: `{ duration: number, dimensions: { width: number, height: number } }`
- **WEBSITE**: Complex snapshot metadata with capture info

### 2. Annotations Table Enhancements

**New Fields:**
- `target` (Json?): W3C-style target system with selectors and fallbacks
- `style` (Json?): Visual styling options (color, opacity, etc.)
- `updatedAt` (DateTime): Automatic timestamp updates

**Backward Compatibility:**
- `coordinates` field is retained but marked as DEPRECATED
- New annotations use `target`, legacy annotations keep `coordinates`
- Migration utilities help transition existing data

## Target System Structure

The new `target` field supports three modes:

### Region Mode (normalized coordinates)
```typescript
{
  space: 'image' | 'pdf' | 'web' | 'video',
  mode: 'region',
  box: {
    x: 0.321,     // 0-1 normalized
    y: 0.187,     // 0-1 normalized  
    w: 0.25,      // 0-1 normalized
    h: 0.12,      // 0-1 normalized
    relativeTo: 'document' | 'element'
  }
}
```

### Element Mode (for web pages)
```typescript
{
  space: 'web',
  mode: 'element',
  element: {
    css: 'main > section:nth-of-type(2) .price-card:nth-child(3)',
    xpath: '...',
    attributes: { 'data-qa': 'pro-plan' },
    nth: 0,
    stableId: 'dom-uid-abc123'  // injected at snapshot time
  }
}
```

### Text Mode (highlights)
```typescript
{
  space: 'web',
  mode: 'text',
  text: {
    quote: 'Upgrade to Pro',
    prefix: '…',
    suffix: '…',
    start: 102944,   // text-position fallback
    end: 102958      // text-position fallback
  }
}
```

## Migration Process

### Automatic Migration
Run the migration utilities to update existing data:

```typescript
import { runCompleteMigration } from '@/lib/migration-utils'

// Run complete migration
const results = await runCompleteMigration()
```

### Prisma Migration
The schema changes have been applied using Prisma's migration system:

```bash
# The migration is already applied, but for new environments:
npx prisma migrate deploy

# For development:
npx prisma migrate dev
```

### Migration Steps

1. **Add new fields** with default values for backward compatibility
2. **Normalize file metadata** to match new structure
3. **Migrate legacy annotations** from coordinates to target system
4. **Validate data integrity** to ensure no orphaned records

## Backward Compatibility

### Reading Annotations
Use the helper function to get position data:

```typescript
import { getAnnotationPosition } from '@/lib/migration-utils'

const position = getAnnotationPosition(annotation)
if (position.type === 'target') {
  // Use new target system
  handleTargetAnnotation(position.data)
} else {
  // Handle legacy coordinates
  handleLegacyAnnotation(position.data)
}
```

### Creating New Annotations
Always use the target system for new annotations:

```typescript
const newAnnotation = {
  annotationType: 'BOX',
  target: {
    space: 'image',
    mode: 'region',
    box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2, relativeTo: 'document' }
  },
  style: {
    color: '#ff0000',
    opacity: 0.7,
    strokeWidth: 2
  }
}
```

## File Processing States

### Website Snapshots
1. **PENDING**: Snapshot job queued
2. **READY**: Snapshot completed, file ready for annotation
3. **FAILED**: Snapshot failed, retry or manual intervention needed

### Regular Files
- All existing files default to **READY** status
- New uploads are **READY** immediately (except websites)

## Performance Considerations

### New Indexes
The migration adds GIN indexes for JSON fields:
- `annotations_target_idx`: Fast queries on target selectors
- `files_metadata_idx`: Efficient metadata searches
- `files_status_idx`: Quick status filtering

### Query Optimization
- Use `target` field for new annotation queries
- Keep `coordinates` queries for legacy compatibility
- Index on `updatedAt` for change tracking

## Testing Migration

### Validation Functions
```typescript
import { validateAnnotationIntegrity } from '@/lib/migration-utils'

// Ensure all annotations have positioning data
const isValid = await validateAnnotationIntegrity()
```

### Rollback Strategy
If issues arise:
1. Keep `coordinates` field intact during migration
2. Can revert to legacy system by ignoring `target` field
3. No data loss during transition period

## Next Steps

After successful migration:
1. Test annotation creation with new target system
2. Implement website snapshot processing
3. Add coordinate transformation utilities
4. Create UI components for advanced annotation modes

## API Changes

### New Endpoints Needed
- `POST /api/files` - Enhanced to handle URL snapshots
- `POST /api/annotations` - Updated to accept target format
- `GET /api/files/:id/snapshot-status` - Check snapshot processing

### Updated Response Formats
Files now include `status` and enhanced `metadata`
Annotations include `target`, `style`, and `updatedAt`

This migration maintains full backward compatibility while enabling the advanced annotation features described in the specification document.
