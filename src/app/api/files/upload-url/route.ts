import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'
import { AuthorizationService } from '@/lib/authorization'
import { Role } from '@prisma/client'

export async function POST (request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileName, fileType, fileSize, projectId, customName } = await request.json()

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

    // Check subscription limits for file size (from env vars - secure)
    const { SubscriptionService } = await import('@/lib/subscription')
    const subscription = await SubscriptionService.getUserSubscription(user.id)
    const limits = subscription ? (subscription.plan.featureLimits as unknown as { fileSizeLimitMB?: { max: number } }) : await SubscriptionService.getFreeTierLimits()
    
    // Limits are already from env vars via SubscriptionService, safe to use
    const maxFileSizeMB = limits.fileSizeLimitMB?.max || 20 // Fallback only if env var not set
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

    // Check access using authorization service - EDITOR or ADMIN required
    const authResult = await AuthorizationService.checkProjectAccessWithRole(projectId, userId, Role.EDITOR)
    if (!authResult.hasAccess) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    // Get project
    const project = await prisma.projects.findUnique({
      where: { id: projectId }
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
        id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fileName,
        fileUrl: filePath, // Will be updated after upload
        fileType: getFileTypeEnum(fileType),
        fileSize,
        projectId,
        status: 'PENDING',
        updatedAt: new Date(),
        metadata: {
          originalName: fileName,
          mimeType: fileType,
          uploadedBy: userId,
          ...(customName && { customName })
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
