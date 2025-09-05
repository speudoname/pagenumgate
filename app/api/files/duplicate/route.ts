import { NextRequest, NextResponse } from 'next/server'
import { list, copy } from '@vercel/blob'
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

    // Generate a unique name for the duplicate
    const generateUniqueName = (originalPath: string, counter: number = 1): string => {
      const pathParts = originalPath.split('/')
      const fileName = pathParts[pathParts.length - 1]
      
      // Split filename and extension
      const lastDotIndex = fileName.lastIndexOf('.')
      let baseName = fileName
      let extension = ''
      
      if (lastDotIndex > 0 && type === 'file') {
        baseName = fileName.substring(0, lastDotIndex)
        extension = fileName.substring(lastDotIndex)
      }
      
      // Check if it already has a copy suffix
      const copyPattern = / copy( \d+)?$/
      if (copyPattern.test(baseName)) {
        baseName = baseName.replace(copyPattern, '')
      }
      
      // Add copy suffix
      const suffix = counter === 1 ? ' copy' : ` copy ${counter}`
      const newFileName = type === 'file' ? `${baseName}${suffix}${extension}` : `${baseName}${suffix}`
      
      pathParts[pathParts.length - 1] = newFileName
      return pathParts.join('/')
    }

    if (type === 'folder') {
      // For folders, duplicate all contents
      const { blobs } = await list({
        prefix: fullPath
      })

      if (blobs.length === 0) {
        return NextResponse.json(
          { error: 'Folder not found or empty' },
          { status: 404 }
        )
      }

      // Find a unique folder name
      let counter = 1
      let newFolderPath = generateUniqueName(fullPath, counter)
      
      // Check if the new path exists
      while (true) {
        const { blobs: existingBlobs } = await list({
          prefix: newFolderPath,
          limit: 1
        })
        
        if (existingBlobs.length === 0) {
          break
        }
        
        counter++
        newFolderPath = generateUniqueName(fullPath, counter)
      }

      // Copy all files to new location
      for (const blob of blobs) {
        const relativePath = blob.pathname.substring(fullPath.length)
        const newBlobPath = newFolderPath + relativePath
        
        await copy(blob.url, newBlobPath, { access: 'public' })
      }

      return NextResponse.json({
        success: true,
        message: 'Folder duplicated successfully',
        newPath: newFolderPath.replace(`${tenantId}/`, '')
      })
    } else {
      // For single file
      const { blobs } = await list({
        prefix: fullPath,
        limit: 1
      })

      if (blobs.length === 0) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        )
      }

      const originalBlob = blobs[0]
      
      // Find a unique file name
      let counter = 1
      let newFilePath = generateUniqueName(fullPath, counter)
      
      // Check if the new path exists
      while (true) {
        const { blobs: existingBlobs } = await list({
          prefix: newFilePath,
          limit: 1
        })
        
        if (existingBlobs.length === 0) {
          break
        }
        
        counter++
        newFilePath = generateUniqueName(fullPath, counter)
      }
      
      // Copy to new location
      await copy(originalBlob.url, newFilePath, { access: 'public' })

      return NextResponse.json({
        success: true,
        message: 'File duplicated successfully',
        newPath: newFilePath.replace(`${tenantId}/`, '')
      })
    }
  } catch (error) {
    logger.error('Duplicate error:', error)
    return NextResponse.json(
      { error: 'Failed to duplicate' },
      { status: 500 }
    )
  }
}