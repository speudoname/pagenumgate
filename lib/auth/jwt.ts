import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { logger } from '@/lib/utils/logger'

const JWT_SECRET = process.env.JWT_SECRET!

export interface JWTPayload {
  tenant_id: string
  user_id: string
  email: string
  role: string
  permissions: string[]
}

// Convert string secret to Uint8Array for jose
const secret = new TextEncoder().encode(JWT_SECRET)

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as JWTPayload
  } catch (error) {
    logger.error('Token verification error:', error)
    return null
  }
}

export async function setTokenCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set('pb-auth-token', token, {
    httpOnly: true,
    secure: false, // Set to false for localhost
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/'
  })
}

export async function getTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('pb-auth-token')
  return token?.value || null
}

export async function clearTokenCookie() {
  const cookieStore = await cookies()
  cookieStore.delete('pb-auth-token')
}