import { NextRequest, NextResponse } from 'next/server'
import { list, copy, del } from '@vercel/blob'
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

    const { sourcePath, targetPath } = await request.json()

    if (!sourcePath || !targetPath) {
      return NextResponse.json(
        { error: 'Source and target paths are required' },
        { status: 400 }
      )
    }

    // Security: Ensure paths belong to this tenant
    const fullSourcePath = sourcePath.startsWith(`${tenantId}/`) ? sourcePath : `${tenantId}/${sourcePath}`
    const fullTargetPath = targetPath.startsWith(`${tenantId}/`) ? targetPath : `${tenantId}/${targetPath}`
    
    if (!fullSourcePath.startsWith(`${tenantId}/`) || !fullTargetPath.startsWith(`${tenantId}/`)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Find the source file
    const { blobs: sourceBlobs } = await list({
      prefix: fullSourcePath,
      limit: 1
    })

    if (sourceBlobs.length === 0) {
      return NextResponse.json(
        { error: 'Source file not found' },
        { status: 404 }
      )
    }

    const sourceBlob = sourceBlobs[0]

    // Copy to new location
    await copy(sourceBlob.url, fullTargetPath, { access: 'public' })
    
    // Delete original
    await del(sourceBlob.url)

    // Determine if this is a publish or unpublish action
    const isPublishing = sourcePath.includes('/unpublished/') && !targetPath.includes('/unpublished/')
    const isUnpublishing = !sourcePath.includes('/unpublished/') && targetPath.includes('/unpublished/')

    let message = 'File moved successfully'
    if (isPublishing) {
      message = 'File published successfully'
    } else if (isUnpublishing) {
      message = 'File unpublished successfully'
    }

    return NextResponse.json({
      success: true,
      message,
      newPath: fullTargetPath.replace(`${tenantId}/`, '')
    })
  } catch (error) {
    logger.error('Move file error:', error)
    return NextResponse.json(
      { error: 'Failed to move file' },
      { status: 500 }
    )
  }
}