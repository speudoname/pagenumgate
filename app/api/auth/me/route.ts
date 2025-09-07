import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'
import { logger } from '@/lib/utils/logger'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Check for token from either header (from nginx) or cookie
    const headerToken = request.headers.get('x-auth-token')
    const cookieToken = request.cookies.get('pb-auth-token')?.value
    const token = headerToken || cookieToken

    if (!token) {
      return NextResponse.json({ error: 'No authentication token' }, { status: 401 })
    }

    // Verify the token
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get tenant information from Supabase
    let tenantInfo = null
    if (payload.tenant_id) {
      const supabase = createClient()
      const { data: tenant } = await supabase
        .from('tenants')
        .select('slug, custom_domain')
        .eq('id', payload.tenant_id)
        .single()
      
      tenantInfo = tenant
    }

    return NextResponse.json({
      tenant_id: payload.tenant_id || '',
      user_id: payload.user_id || '',
      email: payload.email || '',
      role: payload.role || 'user',
      tenant: tenantInfo
    })
  } catch (error) {
    logger.error('Get user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}