import { NextRequest, NextResponse } from 'next/server'
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

    const { url, path } = await request.json()

    if (!url && !path) {
      return NextResponse.json(
        { error: 'File URL or path is required' },
        { status: 400 }
      )
    }

    // Verify the file belongs to this tenant
    if (path && !path.startsWith(`${tenantId}/`)) {
      return NextResponse.json(
        { error: 'Access denied to this file' },
        { status: 403 }
      )
    }

    // SECURITY: Validate URL is from Vercel Blob storage only
    const allowedDomains = [
      'public.blob.vercel-storage.com',
      'blob.vercel-storage.com'
    ]
    
    try {
      const urlObj = new URL(url)
      if (!allowedDomains.some(domain => urlObj.hostname.endsWith(domain))) {
        return NextResponse.json(
          { error: 'Invalid file source' },
          { status: 403 }
        )
      }
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }
    
    // Fetch the file content from validated blob URL
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || 'text/plain'
    const content = await response.text()

    return NextResponse.json({
      content,
      contentType,
      path,
      url
    })
  } catch (error) {
    logger.error('Read file error:', error)
    return NextResponse.json(
      { error: 'Failed to read file' },
      { status: 500 }
    )
  }
}