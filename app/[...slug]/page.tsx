import { notFound } from 'next/navigation'
import { list } from '@vercel/blob'
import { cookies, headers } from 'next/headers'
import { verifyToken } from '@/lib/auth/jwt'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Helper function to get tenant from domain/subdomain
async function getTenantFromHost(host: string): Promise<string> {
  if (!host) return ''
  
  // Remove port if present (for localhost:3002)
  host = host.split(':')[0]
  
  // Check if it's a platform subdomain (e.g., tenant.numgate.com or tenant.localhost)
  const platformDomains = ['numgate.com', 'localhost', 'vercel.app']
  const isPlatformDomain = platformDomains.some(domain => host.includes(domain))
  
  if (isPlatformDomain) {
    // Extract subdomain
    const parts = host.split('.')
    if (parts.length > 1) {
      const subdomain = parts[0]
      
      // Skip www or app subdomains
      if (subdomain === 'www' || subdomain === 'app') {
        return ''
      }
      
      // Look up tenant by slug
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', subdomain)
        .single()
      
      return tenant?.id || ''
    }
  } else {
    // It's a custom domain - look it up
    const { data: customDomain } = await supabase
      .from('custom_domains')
      .select('tenant_id')
      .eq('domain', host)
      .eq('verified', true)
      .single()
    
    return customDomain?.tenant_id || ''
  }
  
  return ''
}

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
  
  // IMPORTANT: Block any path containing "unpublished"
  if (filePath.includes('unpublished/') || filePath.includes('/unpublished')) {
    return notFound()
  }
  
  try {
    let tenantId: string
    
    // Try to get tenant ID from auth token first (for authenticated preview)
    const cookieStore = await cookies()
    const token = cookieStore.get('pb-auth-token')?.value
    
    if (token) {
      // User is authenticated, use their tenant ID for preview
      const payload = await verifyToken(token)
      if (payload) {
        tenantId = payload.tenant_id
      } else {
        // Invalid token, fall back to domain-based lookup
        const headersList = await headers()
        const host = headersList.get('host') || ''
        tenantId = await getTenantFromHost(host)
      }
    } else {
      // Public access - identify tenant from domain
      const headersList = await headers()
      const host = headersList.get('host') || ''
      tenantId = await getTenantFromHost(host)
    }
    
    if (!tenantId) {
      console.error('Could not identify tenant from domain')
      return notFound()
    }
    
    // Look for the file in blob storage
    const { blobs } = await list({
      prefix: `${tenantId}/${filePath}`,
      limit: 1
    })
    
    if (blobs.length === 0) {
      // Try with .html extension if not provided
      const { blobs: htmlBlobs } = await list({
        prefix: `${tenantId}/${filePath}.html`,
        limit: 1
      })
      
      if (htmlBlobs.length === 0) {
        return notFound()
      }
      
      // Fetch the HTML content
      const response = await fetch(htmlBlobs[0].url)
      if (!response.ok) {
        return notFound()
      }
      
      const content = await response.text()
      return (
        <div dangerouslySetInnerHTML={{ __html: content }} />
      )
    }
    
    // Fetch the content from blob storage
    const response = await fetch(blobs[0].url)
    if (!response.ok) {
      return notFound()
    }
    
    const content = await response.text()
    
    // Return the HTML content directly
    return (
      <div dangerouslySetInnerHTML={{ __html: content }} />
    )
  } catch (error) {
    console.error('Error serving page:', error)
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