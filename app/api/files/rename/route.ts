import { NextRequest, NextResponse } from 'next/server'
import { list, copy, del } from '@vercel/blob'
import { supabaseAdmin } from '@/lib/supabase/server'
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

    const { oldPath, newName, type } = await request.json()

    if (!oldPath || !newName) {
      return NextResponse.json(
        { error: 'Old path and new name are required' },
        { status: 400 }
      )
    }

    // Security: Ensure paths belong to this tenant
    const fullOldPath = oldPath.startsWith(`${tenantId}/`) ? oldPath : `${tenantId}/${oldPath}`
    
    if (!fullOldPath.startsWith(`${tenantId}/`)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Build new path
    const pathParts = fullOldPath.split('/')
    pathParts[pathParts.length - 1] = newName
    const fullNewPath = pathParts.join('/')

    // Ensure new path is also within tenant
    if (!fullNewPath.startsWith(`${tenantId}/`)) {
      return NextResponse.json(
        { error: 'Invalid new name' },
        { status: 400 }
      )
    }

    if (type === 'folder') {
      // For folders, we need to rename all files within
      const { blobs } = await list({
        prefix: fullOldPath
      })

      // Copy all files to new location
      for (const blob of blobs) {
        // Get the relative path within the folder
        const relativePath = blob.pathname.substring(fullOldPath.length)
        const newBlobPath = fullNewPath + relativePath
        
        // Copy to new location
        await copy(blob.url, newBlobPath, { access: 'public' })
      }

      // Delete all old files
      for (const blob of blobs) {
        await del(blob.url)
      }

      // Update published files if any
      const oldPublicPath = fullOldPath.replace(`${tenantId}/`, '')
      const newPublicPath = fullNewPath.replace(`${tenantId}/`, '')
      
      // Get all published files in this folder
      const { data: publishedFiles } = await supabaseAdmin
        .from('published_files')
        .select('id, file_path, blob_url')
        .eq('tenant_id', tenantId)
        .like('file_path', `${oldPublicPath}%`)
      
      // Update each file's path
      if (publishedFiles && publishedFiles.length > 0) {
        for (const file of publishedFiles) {
          const relativePath = file.file_path.substring(oldPublicPath.length)
          const updatedPath = newPublicPath + relativePath
          
          // Also need to update blob URL for the new location
          const { blobs } = await list({
            prefix: `${tenantId}/${updatedPath}`,
            limit: 1
          })
          
          await supabaseAdmin
            .from('published_files')
            .update({ 
              file_path: updatedPath,
              blob_url: blobs[0]?.url || file.blob_url
            })
            .eq('id', file.id)
        }
      }

    } else {
      // For single file rename
      const { blobs } = await list({
        prefix: fullOldPath,
        limit: 1
      })

      if (blobs.length === 0) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        )
      }

      const oldBlob = blobs[0]
      
      // Copy to new location
      const newBlob = await copy(oldBlob.url, fullNewPath, { access: 'public' })
      
      // Delete old file
      await del(oldBlob.url)

      // Update published file if exists
      const oldPublicPath = fullOldPath.replace(`${tenantId}/`, '')
      const newPublicPath = fullNewPath.replace(`${tenantId}/`, '')
      
      const { error: updateError } = await supabaseAdmin
        .from('published_files')
        .update({ 
          file_path: newPublicPath,
          blob_url: newBlob.url
        })
        .eq('tenant_id', tenantId)
        .eq('file_path', oldPublicPath)

      if (updateError) {
        logger.error('Failed to update published file path:', updateError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `${type === 'folder' ? 'Folder' : 'File'} renamed successfully`,
      newPath: fullNewPath.replace(`${tenantId}/`, '')
    })
  } catch (error) {
    logger.error('Rename error:', error)
    return NextResponse.json(
      { error: 'Failed to rename' },
      { status: 500 }
    )
  }
}