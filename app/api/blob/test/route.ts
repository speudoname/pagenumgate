import { NextRequest, NextResponse } from 'next/server'
import { list, head } from '@vercel/blob'

export async function GET(request: NextRequest) {
  try {
    // List all blobs
    const { blobs } = await list()
    
    // Get details for each blob
    const blobDetails = await Promise.all(
      blobs.map(async (blob) => {
        const details = await head(blob.url)
        return {
          pathname: blob.pathname,
          url: blob.url,
          size: blob.size,
          uploadedAt: blob.uploadedAt,
          contentType: details.contentType,
          contentLength: details.contentLength
        }
      })
    )
    
    return NextResponse.json({
      success: true,
      totalBlobs: blobs.length,
      blobs: blobDetails
    })
  } catch (error) {
    console.error('Blob test error:', error)
    return NextResponse.json(
      { error: 'Failed to access Vercel Blob storage', details: error },
      { status: 500 }
    )
  }
}