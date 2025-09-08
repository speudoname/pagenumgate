import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'
import { auth } from '@clerk/nextjs/server'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Use orgId as tenant ID, or user ID for personal workspace
    const tenantId = orgId || userId

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
      
      // Filter out hidden files (starting with .)
      const fileName = relativePath.split('/').pop() || ''
      if (fileName.startsWith('.')) {
        return // Skip hidden files
      }
      
      const parts = relativePath.split('/')
      
      let currentLevel = fileTree.children
      let currentPath = ''
      
      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part
        
        if (index === parts.length - 1) {
          // It's a file
          const extension = part.split('.').pop()?.toLowerCase() || ''
          currentLevel.push({
            name: part,
            type: 'file',
            path: relativePath,
            url: blob.url,
            size: blob.size,
            uploadedAt: blob.uploadedAt,
            extension
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

    return NextResponse.json({ files: fileTree })
  } catch (error) {
    logger.error('Error listing files:', error)
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    )
  }
}