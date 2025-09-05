import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken, setTokenCookie } from '@/lib/auth/jwt'
import { logger } from '@/lib/utils/logger'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip authentication for published pages (catch-all route handles its own access control)
  // The catch-all route will block unpublished content itself
  const isPublishedPage = !pathname.startsWith('/api/') && 
                          !pathname.startsWith('/_next/') && 
                          pathname !== '/' &&
                          pathname !== '/favicon.ico'
  
  if (isPublishedPage) {
    // Let the catch-all route handle access control for published/unpublished content
    return NextResponse.next()
  }

  // API routes need authentication
  const isApiRoute = pathname.startsWith('/api/')

  // Check if request is coming from gateway proxy (has x-auth-token header)
  const headerToken = request.headers.get('x-auth-token')
  if (headerToken) {
    logger.log('Request from gateway proxy with token')
    // Set the token as cookie for the Page Builder app to use
    const response = NextResponse.next()
    response.cookies.set('pb-auth-token', headerToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/'
    })
    return response
  }

  // Check if token is in URL (direct access with token)
  const urlToken = request.nextUrl.searchParams.get('token')
  const fromGateway = request.nextUrl.searchParams.get('from') === 'gateway'
  
  if (urlToken && fromGateway) {
    logger.log('Received token from gateway, storing in cookie')
    // Store token in cookie and redirect to clean URL
    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.set('pb-auth-token', urlToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/'
    })
    return response
  }

  // Get token from cookie
  const token = request.cookies.get('pb-auth-token')?.value

  // No token - handle differently for API routes vs pages
  if (!token) {
    logger.log('No token found')
    
    // For API routes, return 401 JSON error
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // For pages, redirect to gateway
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001'
    return NextResponse.redirect(`${gatewayUrl}/login`)
  }

  // Verify token
  const payload = await verifyToken(token)
  
  if (!payload) {
    logger.log('Invalid token')
    
    // For API routes, return 401 JSON error
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }
    
    // For pages, redirect to gateway
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001'
    const response = NextResponse.redirect(`${gatewayUrl}/login`)
    response.cookies.delete('pb-auth-token')
    return response
  }

  logger.log('Token valid for tenant:', payload.tenant_id)
  
  // Add tenant info to headers for API routes
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant-id', payload.tenant_id)
  requestHeaders.set('x-user-id', payload.user_id)
  requestHeaders.set('x-user-email', payload.email)
  requestHeaders.set('x-user-role', payload.role)

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     * 
     * API routes ARE included for authentication
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|public).*)',
  ],
}