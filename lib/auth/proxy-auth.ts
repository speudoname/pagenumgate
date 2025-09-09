import { NextRequest, NextResponse } from 'next/server'

export interface AuthContext {
  tenantId: string
  userId: string
  userEmail: string | null
  userRole: string | null
  isProxied: boolean
}

/**
 * Validates that the request is properly proxied from NUMgate
 * and extracts authentication context from headers
 */
export function requireProxyAuth(request: NextRequest): AuthContext {
  const isProxied = request.headers.get('x-proxied-from') === 'numgate'
  
  // In production, NEVER allow direct access
  if (!isProxied && process.env.NODE_ENV === 'production') {
    throw new Error('Direct access not allowed. This service must be accessed through the gateway.')
  }
  
  // Check proxy secret for additional security
  const proxySecret = request.headers.get('x-proxy-secret')
  if (process.env.PROXY_SECRET && proxySecret !== process.env.PROXY_SECRET) {
    throw new Error('Invalid proxy authentication')
  }
  
  // Extract authentication headers
  const tenantId = request.headers.get('x-tenant-id')
  const userId = request.headers.get('x-user-id')
  const userEmail = request.headers.get('x-user-email')
  const userRole = request.headers.get('x-user-role')
  
  // In production or when proxied, these headers are required
  if (isProxied || process.env.NODE_ENV === 'production') {
    if (!tenantId || !userId) {
      throw new Error('Missing required authentication headers')
    }
  }
  
  // For local development without proxy, return error (no fallback)
  if (!tenantId || !userId) {
    throw new Error('Authentication required. Please access through the gateway.')
  }
  
  return {
    tenantId,
    userId,
    userEmail,
    userRole,
    isProxied
  }
}

/**
 * Wraps an API route handler with proxy authentication
 */
export function withProxyAuth<T extends any[], R>(
  handler: (request: NextRequest, context: AuthContext, ...args: T) => Promise<R>
) {
  return async (request: NextRequest, ...args: T): Promise<R | NextResponse> => {
    try {
      const authContext = requireProxyAuth(request)
      return await handler(request, authContext, ...args)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed'
      return NextResponse.json(
        { error: message },
        { status: 401 }
      )
    }
  }
}