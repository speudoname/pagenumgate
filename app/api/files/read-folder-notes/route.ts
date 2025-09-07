import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'
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

    const { path } = await request.json()

    if (!path) {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      )
    }

    // Construct full path with tenant ID - path should already include .notes.md
    const fullPath = `${tenantId}/${path}`
    
    logger.info('Reading folder notes:', { fullPath })

    // Try to find the exact .notes.md file
    const { blobs } = await list({
      prefix: fullPath,
      limit: 1
    })

    if (blobs.length === 0) {
      // No notes exist yet
      return NextResponse.json({
        content: '',
        exists: false
      })
    }

    // Fetch the content from the blob URL
    const response = await fetch(blobs[0].url)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch notes: ${response.status}`)
    }

    const content = await response.text()

    return NextResponse.json({
      content,
      exists: true,
      url: blobs[0].url
    })
  } catch (error) {
    logger.error('Read folder notes error:', error)
    return NextResponse.json(
      { error: 'Failed to read folder notes' },
      { status: 500 }
    )
  }
}