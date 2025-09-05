import { NextRequest, NextResponse } from 'next/server'

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

    // Fetch the file content from blob URL
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
    console.error('Read file error:', error)
    return NextResponse.json(
      { error: 'Failed to read file', details: error },
      { status: 500 }
    )
  }
}