import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken, setTokenCookie } from '@/lib/auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if request is coming from gateway proxy (has x-auth-token header)
  const headerToken = request.headers.get('x-auth-token')
  if (headerToken) {
    console.log('Request from gateway proxy with token')
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
    console.log('Received token from gateway, storing in cookie')
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

  // No token, redirect to gateway
  if (!token) {
    console.log('No token found, redirecting to gateway')
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001'
    return NextResponse.redirect(`${gatewayUrl}/login`)
  }

  // Verify token
  const payload = await verifyToken(token)
  
  if (!payload) {
    console.log('Invalid token, redirecting to gateway')
    // Invalid token, redirect to gateway
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001'
    const response = NextResponse.redirect(`${gatewayUrl}/login`)
    response.cookies.delete('pb-auth-token')
    return response
  }

  console.log('Token valid for tenant:', payload.tenant_id)
  
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
     * - api (API routes should handle their own auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
}