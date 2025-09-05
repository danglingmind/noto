-- Add files bucket for website snapshots
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
) ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for website snapshots
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

-- Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'files';