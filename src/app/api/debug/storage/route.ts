import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { r2Buckets } from '@/lib/r2-storage'

export async function GET () {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check both buckets

    // List files in project-files bucket
    let projectFiles: string[] = []
    let projectError: string | null = null
    try {
      projectFiles = await r2Buckets.projectFiles().list('', 100)
    } catch (error) {
      projectError = error instanceof Error ? error.message : String(error)
    }

    // List files in snapshots bucket
    let snapshotsFiles: string[] = []
    let snapshotsError: string | null = null
    try {
      snapshotsFiles = await r2Buckets.snapshots().list('', 100)
    } catch (error) {
      snapshotsError = error instanceof Error ? error.message : String(error)
    }

    // List snapshots folder specifically
    let snapshotsFolder: string[] = []
    let snapshotsFolderError: string | null = null
    try {
      snapshotsFolder = await r2Buckets.snapshots().list('snapshots', 100)
    } catch (error) {
      snapshotsFolderError = error instanceof Error ? error.message : String(error)
    }

    return NextResponse.json({
      projectFiles: {
        files: projectFiles,
        error: projectError
      },
      snapshotsFiles: {
        files: snapshotsFiles,
        error: snapshotsError
      },
      snapshotsFolder: {
        files: snapshotsFolder,
        error: snapshotsFolderError
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
