import { NextRequest, NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'

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

    const { path, content, contentType = 'text/html' } = await request.json()

    if (!path || !content) {
      return NextResponse.json(
        { error: 'Path and content are required' },
        { status: 400 }
      )
    }

    // Ensure the path includes tenant ID for isolation
    const fullPath = path.startsWith(`${tenantId}/`) ? path : `${tenantId}/${path}`

    // Delete existing file if it exists (Vercel Blob doesn't support overwrite)
    try {
      await del(fullPath)
    } catch (e) {
      // File might not exist, that's okay
    }

    // Save the new content
    const blob = await put(fullPath, content, {
      access: 'public',
      contentType
    })

    return NextResponse.json({
      success: true,
      path: fullPath,
      url: blob.url,
      size: blob.size
    })
  } catch (error) {
    console.error('Save file error:', error)
    return NextResponse.json(
      { error: 'Failed to save file', details: error },
      { status: 500 }
    )
  }
}