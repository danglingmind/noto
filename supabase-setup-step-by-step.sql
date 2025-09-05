-- Supabase Storage Setup - Step by Step
-- Run each section separately in Supabase SQL Editor

-- STEP 1: Check if bucket already exists
SELECT * FROM storage.buckets WHERE id = 'project-files';

-- STEP 2: Create bucket only if it doesn't exist
-- If the above query returns no rows, run this:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'project-files', 
  'project-files', 
  false,
  524288000,  -- 500MB limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'video/mp4', 'video/webm', 'video/ogg',
    'text/html'
  ]
);

-- STEP 3: Check if RLS is enabled (should return 't')
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'objects' AND relnamespace = (
  SELECT oid FROM pg_namespace WHERE nspname = 'storage'
);

-- STEP 4: Create RLS policies (run these one by one)

-- Policy 1: Upload files
CREATE POLICY "Users can upload to project folders" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    bucket_id = 'project-files'
  );

-- Policy 2: Read files  
CREATE POLICY "Users can read project files" ON storage.objects
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'project-files'
  );

-- Policy 3: Update files
CREATE POLICY "Users can update project files" ON storage.objects
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'project-files'
  );

-- Policy 4: Delete files
CREATE POLICY "Users can delete project files" ON storage.objects
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'project-files'
  );

-- STEP 5: Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';
