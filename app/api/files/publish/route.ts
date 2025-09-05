import { NextRequest, NextResponse } from 'next/server'
import { list } from '@vercel/blob'
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

    const { path, action } = await request.json()

    if (!path) {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      )
    }

    if (!action || !['publish', 'unpublish'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "publish" or "unpublish"' },
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

    // Remove tenant prefix for public path
    const publicPath = fullPath.replace(`${tenantId}/`, '')

    if (action === 'publish') {
      // Find the blob URL
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

      const blob = blobs[0]

      // Check if already published
      const { data: existing } = await supabaseAdmin
        .from('published_files')
        .select('id, is_published')
        .eq('tenant_id', tenantId)
        .eq('file_path', publicPath)
        .single()

      if (existing) {
        // Update existing record
        const { error } = await supabaseAdmin
          .from('published_files')
          .update({
            is_published: true,
            published_at: new Date().toISOString(),
            blob_url: blob.url,
            unpublished_at: null
          })
          .eq('id', existing.id)

        if (error) {
          logger.error('Failed to update published file:', error)
          return NextResponse.json(
            { error: 'Failed to publish file' },
            { status: 500 }
          )
        }
      } else {
        // Create new record
        const { error } = await supabaseAdmin
          .from('published_files')
          .insert({
            tenant_id: tenantId,
            file_path: publicPath,
            blob_url: blob.url,
            is_published: true
          })

        if (error) {
          logger.error('Failed to create published file:', error)
          return NextResponse.json(
            { error: 'Failed to publish file' },
            { status: 500 }
          )
        }
      }

      // Generate the public URL
      const publicUrl = `/${publicPath}`

      return NextResponse.json({
        success: true,
        message: 'File published successfully',
        publicUrl
      })
    } else {
      // Unpublish
      const { error } = await supabaseAdmin
        .from('published_files')
        .update({
          is_published: false,
          unpublished_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .eq('file_path', publicPath)

      if (error) {
        logger.error('Failed to unpublish file:', error)
        return NextResponse.json(
          { error: 'Failed to unpublish file' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'File unpublished successfully'
      })
    }
  } catch (error) {
    logger.error('Publish/unpublish error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

// GET endpoint to check if a file is published
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id')
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'No tenant context found' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')

    if (!path) {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      )
    }

    // Remove tenant prefix if present
    const publicPath = path.replace(`${tenantId}/`, '')

    const { data } = await supabaseAdmin
      .from('published_files')
      .select('is_published, published_at, blob_url')
      .eq('tenant_id', tenantId)
      .eq('file_path', publicPath)
      .single()

    if (!data || !data.is_published) {
      return NextResponse.json({
        isPublished: false
      })
    }

    return NextResponse.json({
      isPublished: true,
      publishedAt: data.published_at,
      publicUrl: `/${publicPath}`
    })
  } catch (error) {
    logger.error('Check publish status error:', error)
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    )
  }
}