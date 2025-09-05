import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/server'
import { headers } from 'next/headers'

interface PageProps {
  params: Promise<{
    slug: string[]
  }>
}

export default async function PublishedPage({ params }: PageProps) {
  const resolvedParams = await params
  const slug = resolvedParams.slug
  
  // Build the file path from slug segments
  const filePath = slug.join('/')
  
  // Get the host to extract tenant info
  const headersList = await headers()
  const host = headersList.get('host') || ''
  
  // Extract tenant from subdomain or use default
  let tenantSlug = 'default'
  if (host.includes('.')) {
    const subdomain = host.split('.')[0]
    if (subdomain && subdomain !== 'www') {
      tenantSlug = subdomain
    }
  }
  
  try {
    // Look up tenant by slug
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .single()
    
    if (!tenant) {
      return notFound()
    }
    
    // Check if this file is published
    const { data: publishedFile } = await supabaseAdmin
      .from('published_files')
      .select('blob_url')
      .eq('tenant_id', tenant.id)
      .eq('file_path', filePath)
      .eq('is_published', true)
      .single()
    
    if (!publishedFile) {
      return notFound()
    }
    
    // Fetch the content from blob storage
    const response = await fetch(publishedFile.blob_url)
    if (!response.ok) {
      return notFound()
    }
    
    const content = await response.text()
    
    // Return the HTML content directly
    return (
      <div dangerouslySetInnerHTML={{ __html: content }} />
    )
  } catch (error) {
    console.error('Error serving published page:', error)
    return notFound()
  }
}

// Generate metadata for the page
export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params
  const slug = resolvedParams.slug
  const filePath = slug.join('/')
  
  return {
    title: filePath.replace(/\.html?$/i, '').replace(/\//g, ' - '),
  }
}