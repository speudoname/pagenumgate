// Helper to get the correct API base path
export function getApiUrl(path: string): string {
  // In production, we're served from /page-builder subpath
  const basePath = process.env.NODE_ENV === 'production' ? '/page-builder' : ''
  return `${basePath}${path}`
}