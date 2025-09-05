import { notFound } from 'next/navigation'
import { list } from '@vercel/blob'

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
    // For now, use a default tenant ID (should come from auth context in production)
    // In production, this would come from middleware/auth
    const tenantId = process.env.DEFAULT_TENANT_ID || 'default'
    
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