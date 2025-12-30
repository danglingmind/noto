-- Supabase Storage Setup - All Buckets
-- Run this single SQL script in Supabase SQL Editor to create all required buckets

-- ============================================================================
-- 1. PROJECT FILES BUCKET
-- ============================================================================
-- For general project files (images, PDFs, videos, HTML)
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
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload to project folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can read project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete project files" ON storage.objects;

-- Create RLS policies for project-files bucket
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

-- ============================================================================
-- 2. COMMENT IMAGES BUCKET
-- ============================================================================
-- For comment attachments (images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'comment-images', 
  'comment-images', 
  false,  -- Private bucket
  10485760,  -- 10MB limit per image
  ARRAY[
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload comment images" ON storage.objects;
DROP POLICY IF EXISTS "Users can read comment images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update comment images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete comment images" ON storage.objects;

-- Create RLS policies for comment-images bucket
CREATE POLICY "Users can upload comment images" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    bucket_id = 'comment-images'
  );

CREATE POLICY "Users can read comment images" ON storage.objects
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'comment-images'
  );

CREATE POLICY "Users can update comment images" ON storage.objects
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'comment-images'
  );

CREATE POLICY "Users can delete comment images" ON storage.objects
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'comment-images'
  );

-- ============================================================================
-- 3. FILES BUCKET (Website Snapshots)
-- ============================================================================
-- For website snapshots (HTML files)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'files', 
  'files', 
  false,  -- Private bucket
  104857600,  -- 100MB limit (HTML snapshots are usually small)
  ARRAY[
    'text/html',
    'text/plain',
    'application/json'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload snapshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can read snapshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can update snapshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete snapshots" ON storage.objects;

-- Create RLS policies for files bucket (snapshots only)
CREATE POLICY "Users can upload snapshots" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    bucket_id = 'files' AND
    name LIKE 'snapshots/%'
  );

CREATE POLICY "Users can read snapshots" ON storage.objects
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'files' AND
    name LIKE 'snapshots/%'
  );

CREATE POLICY "Users can update snapshots" ON storage.objects
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'files' AND
    name LIKE 'snapshots/%'
  );

CREATE POLICY "Users can delete snapshots" ON storage.objects
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'files' AND
    name LIKE 'snapshots/%'
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Verify all buckets were created
SELECT 
  id, 
  name, 
  public, 
  file_size_limit, 
  allowed_mime_types,
  created_at
FROM storage.buckets 
WHERE id IN ('project-files', 'comment-images', 'files')
ORDER BY id;

-- Verify all policies were created
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname IN (
    'Users can upload to project folders',
    'Users can read project files',
    'Users can update project files',
    'Users can delete project files',
    'Users can upload comment images',
    'Users can read comment images',
    'Users can update comment images',
    'Users can delete comment images',
    'Users can upload snapshots',
    'Users can read snapshots',
    'Users can update snapshots',
    'Users can delete snapshots'
  )
ORDER BY policyname;

