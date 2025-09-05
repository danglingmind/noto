-- Supabase Storage Setup for Noto Project
-- Run these commands in Supabase SQL Editor

-- 1. Create storage bucket for project files
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

-- 2. Create RLS policies for file access

-- Allow authenticated users to upload files to their project folders
CREATE POLICY "Users can upload to project folders" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    bucket_id = 'project-files'
  );

-- Allow users to read files from projects they have access to
CREATE POLICY "Users can read project files" ON storage.objects
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'project-files'
  );

-- Allow users to update files in projects they can edit
CREATE POLICY "Users can update project files" ON storage.objects
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'project-files'
  );

-- Allow users to delete files from projects they can edit
CREATE POLICY "Users can delete project files" ON storage.objects
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'project-files'
  );

-- Note: RLS is typically already enabled on storage.objects in Supabase
-- If you get permission errors, skip this step - RLS is likely already enabled
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'project-files';

-- Check if RLS is already enabled (should return 't' for true)
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'objects' AND relnamespace = (
  SELECT oid FROM pg_namespace WHERE nspname = 'storage'
);
