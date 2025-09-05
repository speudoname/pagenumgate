import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'
import { verifyToken } from '@/lib/auth/jwt'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    // Get tenant ID from headers (set by middleware)
    const tenantId = request.headers.get('x-tenant-id')
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'No tenant context found' },
        { status: 401 }
      )
    }

    // List all blobs for this tenant
    const { blobs } = await list({
      prefix: `${tenantId}/`
    })

    // Transform blob data into a file tree structure
    const fileTree: any = {
      name: 'root',
      type: 'folder',
      path: '',
      children: []
    }

    // Build the tree structure
    blobs.forEach(blob => {
      // Remove tenant ID prefix from pathname
      const relativePath = blob.pathname.replace(`${tenantId}/`, '')
      const parts = relativePath.split('/')
      
      let currentLevel = fileTree.children
      let currentPath = ''
      
      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part
        
        if (index === parts.length - 1) {
          // It's a file
          currentLevel.push({
            name: part,
            type: 'file',
            path: blob.pathname,
            url: blob.url,
            size: blob.size,
            uploadedAt: blob.uploadedAt
          })
        } else {
          // It's a folder
          let folder = currentLevel.find((item: any) => 
            item.type === 'folder' && item.name === part
          )
          
          if (!folder) {
            folder = {
              name: part,
              type: 'folder',
              path: currentPath,
              children: []
            }
            currentLevel.push(folder)
          }
          
          currentLevel = folder.children
        }
      })
    })

    return NextResponse.json({
      tenantId,
      files: fileTree,
      totalFiles: blobs.length
    })
  } catch (error) {
    logger.error('List files error:', error)
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    )
  }
}