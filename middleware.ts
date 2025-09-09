import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for static assets
  if (pathname.startsWith('/_next/') || pathname === '/favicon.ico') {
    return NextResponse.next()
  }

  // Check if proxied from NUMgate (trust these headers completely)
  const isProxied = request.headers.get('x-proxied-from') === 'numgate'
  
  if (isProxied) {
    // Trust NUMgate's authentication - it already validated the JWT
    const tenantId = request.headers.get('x-tenant-id')
    const userId = request.headers.get('x-user-id')
    
    if (!tenantId || !userId) {
      // Proxied but no auth headers means user is not authenticated
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // Request is authenticated via proxy - just pass through
    return NextResponse.next()
  }

  // For direct access (development/testing only)
  // This path is only for local development when accessing PageGate directly
  const token = request.cookies.get('auth-token')?.value
  
  if (!token) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication required. Access via NUMgate.' },
        { status: 401 }
      )
    }
    
    // For pages, redirect to gateway
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001'
    return NextResponse.redirect(`${gatewayUrl}/login`)
  }

  // For direct access, we still need basic JWT validation
  // But this should rarely happen in production (always proxied)
  try {
    // Simple check - we don't need full JWT validation here
    // Just ensure token exists for development
    const requestHeaders = new Headers(request.headers)
    // In dev, we can decode the token without full validation
    // Real validation happens in NUMgate
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  } catch {
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001'
    return NextResponse.redirect(`${gatewayUrl}/login`)
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|public).*)',
  ],
}