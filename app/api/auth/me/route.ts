import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Middleware already validated - just get headers
    const tenantId = request.headers.get('x-tenant-id')
    const userId = request.headers.get('x-user-id')
    const email = request.headers.get('x-user-email')
    const role = request.headers.get('x-user-role')

    // If no headers, middleware should have blocked this
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get tenant information from Supabase
    let tenantInfo = null
    if (tenantId) {
      const supabase = createClient()
      const { data: tenant } = await supabase
        .from('tenants')
        .select('slug, custom_domain')
        .eq('id', tenantId)
        .single()
      
      tenantInfo = tenant
    }

    return NextResponse.json({
      tenant_id: tenantId,
      user_id: userId,
      email: email || '',
      role: role || 'user',
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