import { NextRequest, NextResponse } from 'next/server'
import { put, list, del } from '@vercel/blob'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    // Test 1: Check if blob token is in environment
    const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN
    logger.log('Blob token present:', hasToken)
    
    // Test 2: Try to list blobs
    let listSuccess = false
    let listError = null
    try {
      const { blobs } = await list({ limit: 1 })
      listSuccess = true
      logger.log('Blob list succeeded, found blobs:', blobs.length)
    } catch (error) {
      listError = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Blob list failed:', error)
    }
    
    // Test 3: Try to create a test file
    const testPath = 'test-tenant/test-file.txt'
    let putSuccess = false
    let putError = null
    let blobUrl = null
    
    try {
      const blob = await put(testPath, 'Test content from API', {
        access: 'public',
        contentType: 'text/plain'
      })
      putSuccess = true
      blobUrl = blob.url
      logger.log('Blob put succeeded:', blob.url)
      
      // Clean up test file
      await del(testPath)
    } catch (error) {
      putError = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Blob put failed:', error)
    }
    
    return NextResponse.json({
      tests: {
        tokenPresent: hasToken,
        tokenValue: hasToken ? process.env.BLOB_READ_WRITE_TOKEN?.substring(0, 20) + '...' : null,
        listOperation: {
          success: listSuccess,
          error: listError
        },
        putOperation: {
          success: putSuccess,
          error: putError,
          url: blobUrl
        }
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasVercelEnv: !!process.env.VERCEL,
        hasVercelUrl: !!process.env.VERCEL_URL
      }
    })
  } catch (error) {
    logger.error('Test blob error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Test failed' },
      { status: 500 }
    )
  }
}