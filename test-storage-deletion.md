# Storage Deletion Test Guide

## Issue Fixed
The website snapshots were not being deleted from Supabase storage because:
1. The code was **skipping** website files entirely (`if (file.fileType !== 'WEBSITE')`)
2. The code was using the **wrong bucket** (`'project-files'` instead of `'files'`)

## What Was Fixed

### File Deletion API (`/api/files/[id]`)
- ✅ Now deletes website snapshots from the `'files'` bucket
- ✅ Still deletes other files from the `'project-files'` bucket
- ✅ Added proper bucket selection logic
- ✅ Added logging for debugging

### Project Deletion API (`/api/projects/[id]`)
- ✅ Now deletes all files (including website snapshots) from both buckets
- ✅ Groups files by bucket for efficient deletion
- ✅ Added logging for debugging

### Workspace Deletion API (`/api/workspaces/[id]`)
- ✅ Now deletes all files (including website snapshots) from both buckets
- ✅ Groups files by bucket for efficient deletion
- ✅ Added logging for debugging

## How to Test

### 1. Test File Deletion
1. Create a website snapshot file
2. Check the `'files'` bucket in Supabase to confirm it exists
3. Delete the file through the UI
4. Check the `'files'` bucket again - the file should be gone
5. Check the browser console for deletion logs

### 2. Test Project Deletion
1. Create a project with both regular files and website snapshots
2. Check both buckets to confirm files exist
3. Delete the project through the UI
4. Check both buckets - all files should be gone
5. Check the browser console for deletion logs

### 3. Test Workspace Deletion
1. Create a workspace with projects containing both file types
2. Check both buckets to confirm files exist
3. Delete the workspace through the UI
4. Check both buckets - all files should be gone
5. Check the browser console for deletion logs

## Debugging

### Check Storage Buckets
You can use the debug endpoint to see what's in each bucket:
```
GET /api/debug/storage
```

### Console Logs
The deletion APIs now log:
- Which bucket is being used
- How many files are being deleted
- Success/failure messages

Look for logs like:
```
Deleting file from storage: bucket=files, path=snapshots/filename.html
Successfully deleted file from storage: snapshots/filename.html
```

### Manual Bucket Check
In Supabase Dashboard:
1. Go to Storage
2. Check the `'files'` bucket for website snapshots
3. Check the `'project-files'` bucket for other files

## Expected Behavior

### Before Fix
- ❌ Website snapshots were **not deleted** from storage
- ❌ Only regular files were deleted from `'project-files'` bucket
- ❌ Website snapshots remained in `'files'` bucket

### After Fix
- ✅ Website snapshots are **deleted** from `'files'` bucket
- ✅ Regular files are deleted from `'project-files'` bucket
- ✅ All files are properly cleaned up from storage
- ✅ Console logs show deletion progress

## Bucket Structure

```
Supabase Storage:
├── 'files' bucket
│   └── snapshots/
│       ├── website1.html
│       ├── website2.html
│       └── ...
└── 'project-files' bucket
    ├── project1/
    │   ├── image1.jpg
    │   ├── document1.pdf
    │   └── ...
    └── project2/
        ├── video1.mp4
        └── ...
```

## Troubleshooting

If files are still not being deleted:

1. **Check the fileUrl format** - The code handles both URL and path formats
2. **Check console logs** - Look for deletion messages
3. **Check Supabase permissions** - Ensure the service role has delete permissions
4. **Check file paths** - Ensure the path extraction logic is working correctly

The fix should resolve the issue where website snapshots were not being deleted from the `'files'` bucket.
