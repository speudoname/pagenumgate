import { NextRequest, NextResponse } from 'next/server'
import { del, list } from '@vercel/blob'
import { logger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    // Get tenant ID from headers (set by middleware)
    const tenantId = request.headers.get('x-tenant-id')
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'No tenant context found' },
        { status: 401 }
      )
    }

    const { path, type } = await request.json()

    if (!path) {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      )
    }

    // Security: Ensure path belongs to this tenant
    const fullPath = path.startsWith(`${tenantId}/`) ? path : `${tenantId}/${path}`
    
    if (!fullPath.startsWith(`${tenantId}/`)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // If it's a folder, we need to delete all contents first
    if (type === 'folder') {
      // Ensure we only delete files in THIS folder, not folders with similar names
      // Add a trailing slash to ensure exact folder match
      const folderPrefix = fullPath.endsWith('/') ? fullPath : `${fullPath}/`
      
      const { blobs } = await list({
        prefix: folderPrefix
      })
      
      // Delete all files in the folder
      for (const blob of blobs) {
        await del(blob.url)
      }
    } else {
      // Delete single file
      // Find the blob URL first
      const { blobs } = await list({
        prefix: fullPath
      })
      
      if (blobs.length > 0) {
        await del(blobs[0].url)
      }
    }

    return NextResponse.json({
      success: true,
      message: `${type === 'folder' ? 'Folder' : 'File'} deleted successfully`
    })
  } catch (error) {
    logger.error('Delete file error:', error)
    return NextResponse.json(
      { error: 'Failed to delete' },
      { status: 500 }
    )
  }
}