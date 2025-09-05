import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // List all files in the project-files bucket
    const { data: files, error } = await supabaseAdmin.storage
      .from('project-files')
      .list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (error) {
      console.error('Error listing storage files:', error)
      return NextResponse.json({ error: 'Failed to list storage files' }, { status: 500 })
    }

    // Also list files by project folders
    const { data: projectFolders, error: folderError } = await supabaseAdmin.storage
      .from('project-files')
      .list('', {
        limit: 100
      })

    return NextResponse.json({ 
      rootFiles: files,
      folders: projectFolders,
      bucketName: 'project-files'
    })

  } catch (error) {
    console.error('Debug storage error:', error)
    return NextResponse.json(
      { error: 'Failed to debug storage' },
      { status: 500 }
    )
  }
}
