import { notFound } from 'next/navigation'
import { list } from '@vercel/blob'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth/jwt'

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
    // Get tenant ID from auth token
    const cookieStore = await cookies()
    const token = cookieStore.get('pb-auth-token')?.value
    
    if (!token) {
      return notFound()
    }
    
    const payload = await verifyToken(token)
    if (!payload) {
      return notFound()
    }
    
    const tenantId = payload.tenant_id
    
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