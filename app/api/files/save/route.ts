import { NextRequest, NextResponse } from 'next/server'
import { put, list, del } from '@vercel/blob'
import { logger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    // Get tenant ID from headers (set by middleware)
    const tenantId = request.headers.get('x-tenant-id')
    
    if (!tenantId) {
      logger.error('No tenant ID in headers')
      return NextResponse.json(
        { error: 'No tenant context found' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { path, content, contentType = 'text/html' } = body

    logger.info('Save request received:', { 
      tenantId, 
      path, 
      contentLength: content?.length,
      contentType 
    })

    if (!path || content === undefined) {
      logger.error('Missing required fields:', { path, hasContent: content !== undefined })
      return NextResponse.json(
        { error: 'Path and content are required' },
        { status: 400 }
      )
    }
    
    // Ensure the path includes tenant ID for isolation
    // The path comes from the client without tenant ID, so we add it
    const fullPath = `${tenantId}/${path}`

    logger.info('Attempting to save file:', { fullPath })

    // Check if file exists and delete it (Vercel Blob doesn't support overwrite)
    try {
      const { blobs } = await list({ prefix: fullPath, limit: 1 })
      logger.info('Existing blobs found:', { count: blobs.length, blobs: blobs.map(b => ({ url: b.url, pathname: b.pathname })) })
      
      if (blobs.length > 0) {
        logger.info('Deleting existing blob:', blobs[0].url)
        await del(blobs[0].url)
        logger.info('Successfully deleted existing blob')
      }
    } catch (e) {
      // File might not exist, that's okay
      logger.debug('File does not exist, creating new:', { fullPath, error: e })
    }

    // Save the new content with addRandomSuffix: false to maintain exact path
    logger.info('Saving new content to blob storage...')
    const blob = await put(fullPath, content, {
      access: 'public',
      contentType,
      addRandomSuffix: false
    })

    logger.info('File saved successfully:', { 
      path: fullPath, 
      size: content.length,
      url: blob.url,
      pathname: blob.pathname 
    })

    return NextResponse.json({
      success: true,
      path: fullPath,
      url: blob.url,
      size: content.length
    })
  } catch (error) {
    logger.error('Save file error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save file' },
      { status: 500 }
    )
  }
}