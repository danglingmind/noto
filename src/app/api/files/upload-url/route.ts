import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST (request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileName, fileType, fileSize, projectId } = await request.json()

    // Validate input
    if (!fileName || !fileType || !fileSize || !projectId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get user's subscription to check file size limit
    const user = await prisma.users.findUnique({
      where: { clerkId: userId }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check subscription limits for file size
    const { SubscriptionService } = await import('@/lib/subscription')
    const subscription = await SubscriptionService.getUserSubscription(user.id)
    const limits = subscription ? (subscription.plan.featureLimits as unknown as { fileSizeLimitMB?: { max: number } }) : await SubscriptionService.getFreeTierLimits()
    
    const maxFileSizeMB = limits.fileSizeLimitMB?.max || 20 // Default to 20MB for free tier
    const maxFileSize = maxFileSizeMB * 1024 * 1024 // Convert MB to bytes
    
    if (fileSize > maxFileSize) {
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${maxFileSizeMB}MB for your current plan` 
      }, { status: 400 })
    }

    // Check file limit for project
    const projectFiles = await prisma.files.count({
      where: { projectId }
    })
    
    const limitCheck = await SubscriptionService.checkFeatureLimit(
      user.id,
      'filesPerProject',
      projectFiles
    )
    
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { 
          error: 'File limit exceeded for this project',
          limit: limitCheck.limit,
          usage: limitCheck.usage,
          message: limitCheck.message
        },
        { status: 403 }
      )
    }

    // Validate project access
    const project = await prisma.projects.findFirst({
      where: {
        id: projectId,
        workspaces: {
          OR: [
            { ownerId: { in: await getUserIds(userId) } },
            {
              workspace_members: {
                some: {
                  users: { clerkId: userId },
                  role: { in: ['EDITOR', 'ADMIN'] }
                }
              }
            }
          ]
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
    const file = await prisma.files.create({
      data: {
        fileName,
        fileUrl: filePath, // Will be updated after upload
        fileType: getFileTypeEnum(fileType),
        fileSize,
        projectId,
        status: 'PENDING',
        metadata: {
          originalName: fileName,
          mimeType: fileType,
          uploadedBy: userId
        }
      }
    })

    // Generate signed upload URL using service role
    const { data: signedUrl, error } = await supabaseAdmin.storage
      .from('project-files')
      .createSignedUploadUrl(filePath, {
        upsert: true
      })

    if (error) {
      // Clean up the database record if URL generation fails
      await prisma.files.delete({ where: { id: file.id } })
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

// Helper function to get user IDs for the current clerk user
async function getUserIds (clerkId: string): Promise<string[]> {
  const users = await prisma.users.findMany({
    where: { clerkId },
    select: { id: true }
  })
  return users.map(user => user.id)
}

function getFileTypeEnum (mimeType: string): 'IMAGE' | 'PDF' | 'VIDEO' | 'WEBSITE' {
  if (mimeType.startsWith('image/')) {
return 'IMAGE'
}
  if (mimeType === 'application/pdf') {
return 'PDF'
}
  if (mimeType.startsWith('video/')) {
return 'VIDEO'
}
  if (mimeType.startsWith('text/html')) {
return 'WEBSITE'
}
  return 'IMAGE' // Default fallback
}
