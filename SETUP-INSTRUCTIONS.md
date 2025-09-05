# Setup Instructions for File Upload Feature

## 🎉 File Upload Implementation Complete!

The file upload system has been successfully implemented following the Quick Start Implementation Guide. Here's what you need to do to get it running:

## ⚠️ CRITICAL: Supabase Storage Setup

**You MUST run this SQL in your Supabase SQL Editor before testing:**

```sql
-- Run this in Supabase Dashboard > SQL Editor
-- Create storage bucket for project files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'project-files', 
  'project-files', 
  false,  -- Private bucket
  524288000,  -- 500MB limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'video/mp4', 'video/webm', 'video/ogg',
    'text/html'
  ]
);

-- Create RLS policies for file access
CREATE POLICY "Users can upload to project folders" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    bucket_id = 'project-files'
  );

CREATE POLICY "Users can read project files" ON storage.objects
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'project-files'
  );

CREATE POLICY "Users can update project files" ON storage.objects
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'project-files'
  );

CREATE POLICY "Users can delete project files" ON storage.objects
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'project-files'
  );

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

## 🚀 Testing the File Upload Feature

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to a project:**
   - Log in to your app
   - Go to a workspace
   - Open any project

3. **Test file upload:**
   - Click the "Upload File" button in the project header
   - Try uploading different file types:
     - Images (PNG, JPG, GIF, WebP, SVG)
     - PDFs
     - Videos (MP4, WebM, OGG)
     - HTML files

4. **Verify functionality:**
   - ✅ Drag & drop works
   - ✅ File type validation works
   - ✅ Progress indicators show
   - ✅ Files appear in project after upload
   - ✅ File icons show correctly
   - ✅ File sizes are displayed

## 📁 What Was Implemented

### API Routes Created:
- `POST /api/files/upload-url` - Generate signed upload URLs
- `POST /api/files/complete` - Complete file upload process
- `GET /api/projects/[id]/files` - Get project files

### Components Created:
- `FileUploadModal` - Drag & drop upload interface
- Updated `ProjectContent` - Integrated upload functionality

### Features:
- ✅ Drag & drop file upload
- ✅ Multiple file selection
- ✅ Progress tracking
- ✅ Error handling
- ✅ File type validation
- ✅ Size limits (500MB)
- ✅ Permission checking (only EDITOR/ADMIN can upload)
- ✅ Real-time UI updates

## 🔧 Environment Variables

Make sure your `.env.local` has:

```env
# Supabase (required for file storage)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Clerk (for authentication)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Database
DATABASE_URL=your_database_url
DIRECT_URL=your_direct_database_url
```

## 🐛 Troubleshooting

### Issue: "Can't reach database server"
- Check your DATABASE_URL and DIRECT_URL in `.env.local`
- Ensure your database is running

### Issue: "Failed to create signed URL"
- Verify Supabase storage bucket was created (run the SQL above)
- Check SUPABASE_SERVICE_ROLE_KEY is correct
- Verify RLS policies are applied

### Issue: Upload fails silently
- Check browser console for errors
- Verify user has EDITOR or ADMIN role in the workspace
- Check Supabase storage logs

### Issue: Files don't appear after upload
- Check if the API route `/api/projects/[id]/files` returns data
- Verify file status is set to 'READY' in database
- Try refreshing the page

## ✅ Success Criteria Checklist

- [ ] **File Selection**: Drag & drop and click to select works
- [ ] **File Validation**: Only allowed file types are accepted
- [ ] **Size Limits**: Files over 500MB are rejected
- [ ] **Upload Progress**: Progress indicators work correctly
- [ ] **Error Handling**: Network errors are handled gracefully
- [ ] **Database Storage**: File metadata is stored correctly
- [ ] **File Access**: Uploaded files are accessible via URL
- [ ] **Permissions**: Only editors/admins can upload files
- [ ] **UI Updates**: File list updates after successful upload

## 🎯 Next Steps (Week 2)

Once file upload is working perfectly:

1. **File Viewer Component**: Create viewers for different file types
2. **File Management**: Add delete, rename, and move functionality
3. **Thumbnail Generation**: Create previews for uploaded files
4. **File Organization**: Prepare for folder system integration

## 📞 Need Help?

If you encounter issues:

1. Check the browser console for JavaScript errors
2. Check the Network tab for failed API requests
3. Verify your Supabase storage bucket exists
4. Ensure all environment variables are set correctly
5. Try uploading a small image file first (easiest to debug)

**The file upload system is now ready for testing!** 🎉
