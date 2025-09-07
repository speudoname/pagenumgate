import { NextRequest, NextResponse } from 'next/server'
import { put, del, list } from '@vercel/blob'
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

    const { sourcePath, targetFolder, isFolder } = await request.json()

    if (!sourcePath || targetFolder === undefined) {
      return NextResponse.json(
        { error: 'Source path and target folder are required' },
        { status: 400 }
      )
    }

    logger.info('Moving file/folder:', { sourcePath, targetFolder, isFolder })

    // Extract filename from source path
    const fileName = sourcePath.split('/').pop() || ''
    
    // Construct target path
    const targetPath = targetFolder === '/' || targetFolder === '' 
      ? fileName 
      : `${targetFolder}/${fileName}`

    // Construct full paths with tenant ID
    const fullSourcePath = `${tenantId}/${sourcePath}`
    const fullTargetPath = `${tenantId}/${targetPath}`

    if (isFolder) {
      // For folders, we need to move all files within the folder
      const { blobs } = await list({
        prefix: fullSourcePath
      })

      logger.info(`Found ${blobs.length} files in folder to move`)

      // Process each file
      for (const blob of blobs) {
        // Calculate new path
        const relativePath = blob.pathname.replace(fullSourcePath, '')
        const newPath = `${fullTargetPath}${relativePath}`
        
        logger.info(`Moving ${blob.pathname} to ${newPath}`)
        
        // Fetch the content
        const response = await fetch(blob.url)
        const content = await response.blob()
        
        // Upload to new location
        await put(newPath, content, {
          access: 'public',
          contentType: response.headers.get('content-type') || 'application/octet-stream',
          addRandomSuffix: false
        })
        
        // Delete the original
        await del(blob.url)
      }
      
      logger.info('Folder moved successfully')
    } else {
      // For single files, find and move the file
      const { blobs } = await list({
        prefix: fullSourcePath,
        limit: 1
      })

      if (blobs.length === 0) {
        return NextResponse.json(
          { error: 'Source file not found' },
          { status: 404 }
        )
      }

      const sourceBlob = blobs[0]
      
      // Fetch the content
      const response = await fetch(sourceBlob.url)
      const content = await response.blob()
      
      // Upload to new location
      await put(fullTargetPath, content, {
        access: 'public',
        contentType: response.headers.get('content-type') || 'application/octet-stream',
        addRandomSuffix: false
      })
      
      // Delete the original
      await del(sourceBlob.url)
      
      logger.info('File moved successfully')
    }

    return NextResponse.json({
      success: true,
      message: `${isFolder ? 'Folder' : 'File'} moved successfully`,
      newPath: targetPath
    })
  } catch (error) {
    logger.error('Move file/folder error:', error)
    return NextResponse.json(
      { error: 'Failed to move file/folder' },
      { status: 500 }
    )
  }
}