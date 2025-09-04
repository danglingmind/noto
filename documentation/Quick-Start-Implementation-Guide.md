# Quick Start Implementation Guide

## Week 1: File Upload System - Getting Started

This guide provides step-by-step instructions to begin implementing the first critical feature: the file upload system.

### Prerequisites Checklist

Before starting implementation, ensure you have:

- ✅ **Database Schema**: Applied and working
- ✅ **Supabase Setup**: Account and project configured
- ✅ **Authentication**: Clerk working with login/logout
- ✅ **Basic Navigation**: Dashboard, workspace, project pages working
- ✅ **Development Environment**: Next.js, TypeScript, Tailwind CSS

### Day 1-2: Supabase Storage Configuration

#### 1. Create Storage Bucket
```sql
-- Run in Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-files', 'project-files', false);
```

#### 2. Set Up Row Level Security (RLS) Policies
```sql
-- Allow authenticated users to upload files
CREATE POLICY "Users can upload files" ON storage.objects
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to read files they have access to
CREATE POLICY "Users can read files" ON storage.objects
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow users to delete their own files
CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);
```

#### 3. Configure CORS (if needed)
```javascript
// In Supabase dashboard: Settings > API > CORS
// Add your domain: http://localhost:3000 (for development)
```

### Day 3-4: Install Required Dependencies

```bash
# Install file upload dependencies
npm install react-dropzone
npm install @supabase/storage-js

# Install additional UI components
npm install lucide-react  # For icons (if not already installed)

# Install file processing utilities
npm install file-type      # For file type detection
npm install sharp          # For image processing (optional)
```

### Day 5-7: Implement File Upload API

#### 1. Create API Route for Upload URL Generation
Create `/src/app/api/files/upload-url/route.ts`:

```typescript
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileName, fileType, fileSize, projectId } = await request.json()

    // Validate project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          members: {
            some: {
              user: { clerkId: userId },
              role: { in: ['EDITOR', 'ADMIN'] }
            }
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found or no access' }, { status: 404 })
    }

    // Generate unique file path
    const fileExtension = fileName.split('.').pop()
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExtension}`
    const filePath = `${projectId}/${uniqueFileName}`

    // Create file record in database
    const file = await prisma.file.create({
      data: {
        fileName,
        fileUrl: filePath, // Will be updated after upload
        fileType: getFileTypeEnum(fileType),
        fileSize,
        projectId,
        status: 'PENDING',
        metadata: {
          originalName: fileName,
          mimeType: fileType
        }
      }
    })

    // Generate signed upload URL
    const { data: signedUrl, error } = await supabase.storage
      .from('project-files')
      .createSignedUploadUrl(filePath)

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`)
    }

    return NextResponse.json({
      uploadUrl: signedUrl.signedUrl,
      fileId: file.id,
      filePath
    })

  } catch (error) {
    console.error('Upload URL generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    )
  }
}

function getFileTypeEnum(mimeType: string): 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE' {
  if (mimeType.startsWith('image/')) return 'IMAGE'
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.startsWith('video/')) return 'VIDEO'
  if (mimeType.startsWith('text/html')) return 'WEBSITE'
  return 'IMAGE' // Default fallback
}
```

#### 2. Create API Route for Upload Completion
Create `/src/app/api/files/complete/route.ts`:

```typescript
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileId } = await request.json()

    // Get file record
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { project: true }
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Get public URL for the file
    const { data: publicUrl } = supabase.storage
      .from('project-files')
      .getPublicUrl(file.fileUrl)

    // Update file record with public URL and mark as ready
    const updatedFile = await prisma.file.update({
      where: { id: fileId },
      data: {
        fileUrl: publicUrl.publicUrl,
        status: 'READY',
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ file: updatedFile })

  } catch (error) {
    console.error('Upload completion error:', error)
    return NextResponse.json(
      { error: 'Failed to complete upload' },
      { status: 500 }
    )
  }
}
```

### Day 8-10: Create File Upload Modal Component

#### 1. Create the Upload Modal Component
Create `/src/components/file-upload-modal.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { X, Upload, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onUploadComplete: (files: any[]) => void
}

interface UploadFile {
  file: File
  id: string
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
}

export function FileUploadModal({ 
  isOpen, 
  onClose, 
  projectId, 
  onUploadComplete 
}: FileUploadModalProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      progress: 0,
      status: 'pending'
    }))
    
    setUploadFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'video/*': ['.mp4', '.webm', '.ogg'],
      'text/html': ['.html', '.htm']
    },
    maxSize: 500 * 1024 * 1024, // 500MB
    multiple: true
  })

  const handleUpload = async () => {
    setIsUploading(true)
    
    // Implementation details for file upload
    // (This would include the actual upload logic)
    
    setIsUploading(false)
  }

  // ... rest of component implementation
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Modal content */}
    </Dialog>
  )
}
```

### Day 11-14: Integrate Upload Modal with Project Page

#### 1. Update Project Content Component
Modify `/src/components/project-content.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { FileUploadModal } from '@/components/file-upload-modal'
// ... other imports

export function ProjectContent({ project, userRole }: ProjectContentProps) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [files, setFiles] = useState(project.files || [])

  const handleUploadComplete = (uploadedFiles: any[]) => {
    setFiles(prev => [...prev, ...uploadedFiles])
    // Optionally refresh the project data
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Existing header code */}
      <header className="bg-white border-b">
        <div className="px-6 py-4 flex items-center justify-between">
          {/* ... existing header content ... */}
          <div className="flex items-center space-x-4">
            {canEdit && (
              <Button onClick={() => setIsUploadModalOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            )}
            {/* ... other buttons ... */}
          </div>
        </div>
      </header>

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        projectId={project.id}
        onUploadComplete={handleUploadComplete}
      />

      {/* Rest of component */}
    </div>
  )
}
```

### Testing Checklist

After implementation, verify:

- [ ] **File Selection**: Drag & drop and click to select works
- [ ] **File Validation**: Only allowed file types are accepted
- [ ] **Size Limits**: Files over 500MB are rejected
- [ ] **Upload Progress**: Progress indicators work correctly
- [ ] **Error Handling**: Network errors are handled gracefully
- [ ] **Database Storage**: File metadata is stored correctly
- [ ] **File Access**: Uploaded files are accessible via URL
- [ ] **Permissions**: Only editors/admins can upload files
- [ ] **UI Updates**: File list updates after successful upload

### Common Issues & Solutions

#### Issue: CORS Errors
**Solution**: Configure Supabase CORS settings to include your domain

#### Issue: File Upload Fails Silently
**Solution**: Check Supabase RLS policies and ensure proper authentication

#### Issue: Large Files Timeout
**Solution**: Implement chunked uploads for files > 100MB

#### Issue: File Type Detection Fails
**Solution**: Use server-side file type validation as backup

### Environment Variables Needed

Add to your `.env.local`:

```env
# Supabase (if not already added)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# File Upload Settings
MAX_FILE_SIZE=524288000  # 500MB in bytes
ALLOWED_FILE_TYPES=image/*,application/pdf,video/*,text/html
```

### Next Steps (Week 2)

Once file upload is working:

1. **File Viewer Component**: Create viewers for different file types
2. **File Management**: Add delete, rename, and move functionality
3. **Thumbnail Generation**: Create previews for uploaded files
4. **File Organization**: Prepare for folder system integration

### Success Criteria

Week 1 is complete when:
- ✅ Users can upload multiple files via drag & drop
- ✅ Files are stored in Supabase with proper permissions
- ✅ File metadata is saved to database
- ✅ Upload progress is displayed to users
- ✅ Error handling works for failed uploads
- ✅ Only authorized users can upload files
- ✅ File list updates after successful uploads

This foundation enables all subsequent features that depend on file handling.