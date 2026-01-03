import { getAuth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET (request: NextRequest) {
  try {
    const { userId } = await getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check both buckets

    // List files in project-files bucket
    const { data: projectFiles, error: projectError } = await supabaseAdmin.storage
      .from('project-files')
      .list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    // List files in files bucket (for website snapshots)
    const { data: websiteFiles, error: websiteError } = await supabaseAdmin.storage
      .from('files')
      .list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    // List snapshots folder specifically
    const { data: snapshotsFolder, error: snapshotsError } = await supabaseAdmin.storage
      .from('files')
      .list('snapshots', {
        limit: 100
      })

    return NextResponse.json({
      projectFiles: {
        files: projectFiles,
        error: projectError?.message
      },
      websiteFiles: {
        files: websiteFiles,
        error: websiteError?.message
      },
      snapshotsFolder: {
        files: snapshotsFolder,
        error: snapshotsError?.message
      }
    })

  } catch (error) {
    console.error('Debug storage error:', error)
    return NextResponse.json(
      { error: 'Failed to debug storage' },
      { status: 500 }
    )
  }
}
