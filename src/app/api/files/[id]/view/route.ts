import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: fileId } = await params
    console.log(`File view request for fileId: ${fileId}, userId: ${userId}`)

    // Get file record
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        project: {
          include: {
            workspace: {
              include: {
                owner: true,
                members: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!file) {
      console.log(`File not found in database: ${fileId}`)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    console.log(`File found: ${file.fileName}, status: ${file.status}, fileType: ${file.fileType}`)

    // Handle failed files
    if (file.status === 'FAILED') {
      const metadata = file.metadata as Record<string, unknown>
      return NextResponse.json({ 
        error: 'File processing failed', 
        details: metadata?.error || 'Unknown error during processing',
        originalUrl: metadata?.originalUrl 
      }, { status: 422 })
    }

    // Handle pending files
    if (file.status === 'PENDING') {
      return NextResponse.json({ 
        error: 'File is still being processed', 
        status: 'pending' 
      }, { status: 202 })
    }

    // Get user from database to check access
    const user = await prisma.user.findUnique({
      where: { clerkId: userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user has access to this file
    const hasAccess = file.project.workspace.members.some(member => 
      member.user.clerkId === userId
    ) || file.project.workspace.owner?.clerkId === userId

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Extract the storage path from the full URL if needed
    let storagePath = file.fileUrl
    if (file.fileUrl.includes('/storage/v1/object/')) {
      // Extract path from full Supabase URL
      // Example: https://...supabase.co/storage/v1/object/public/project-files/path/file.pdf
      // Extract: path/file.pdf
      const urlParts = file.fileUrl.split('/storage/v1/object/public/project-files/')
      if (urlParts.length > 1) {
        storagePath = urlParts[1]
      }
    }

    // Debug: Log what we're trying to access
    console.log('Attempting to generate signed URL for:', {
      fileId: file.id,
      fileName: file.fileName,
      originalUrl: file.fileUrl,
      extractedPath: storagePath,
      fileType: file.fileType
    })

    // Handle empty storage path
    if (!storagePath || storagePath.trim() === '') {
      return NextResponse.json(
        { error: 'File not ready for viewing' },
        { status: 404 }
      )
    }

    // Try to generate signed URL with the extracted path
    let signedUrl, error
    
    // Determine the correct bucket based on file type and path
    const bucketName = file.fileType === 'WEBSITE' || storagePath.startsWith('snapshots/') ? 'files' : 'project-files'
    
    // First, try the extracted storage path
    const result = await supabaseAdmin.storage
      .from(bucketName)
      .createSignedUrl(storagePath, 3600)
    
    signedUrl = result.data
    error = result.error

    // If that fails, try to list files in the project folder to find the actual file
    if (error) {
      console.log('First attempt failed, trying to find file in project folder...')
      
      // Only try project folder lookup for non-website files
      if (file.fileType !== 'WEBSITE') {
        const projectPath = storagePath.split('/')[0] // Get project ID part
        const { data: projectFiles, error: listError } = await supabaseAdmin.storage
          .from('project-files')
          .list(projectPath)

        if (!listError && projectFiles) {
        console.log('Files found in project folder:', projectFiles.map(f => f.name))
        
        // Try to find a file that matches our filename
        const matchingFile = projectFiles.find(f => 
          f.name.includes(file.fileName.split('.')[0]) || 
          f.name.endsWith(file.fileName.split('.').pop() || '')
        )
        
        if (matchingFile) {
          const correctPath = `${projectPath}/${matchingFile.name}`
          console.log('Found matching file at:', correctPath)
          
          // Try with the correct path
          const retryResult = await supabaseAdmin.storage
            .from('project-files')
            .createSignedUrl(correctPath, 3600)
          
          if (retryResult.data) {
            signedUrl = retryResult.data
            error = null
            
            // Update the database with the correct path
            await prisma.file.update({
              where: { id: fileId },
              data: { fileUrl: correctPath }
            })
            
            console.log('Updated file path in database to:', correctPath)
          }
        }
        }
      }
    }

    if (error || !signedUrl) {
      console.error('Final error generating signed URL:', error)
      return NextResponse.json({ error: 'Failed to generate file access URL' }, { status: 500 })
    }

    return NextResponse.json({ 
      signedUrl: signedUrl.signedUrl,
      fileName: file.fileName,
      fileType: file.fileType
    })

  } catch (error) {
    console.error('File view error:', error)
    return NextResponse.json(
      { error: 'Failed to access file' },
      { status: 500 }
    )
  }
}
