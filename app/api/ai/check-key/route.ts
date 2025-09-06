import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id')
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if API key exists for this tenant
    const { data, error } = await supabase
      .from('ai_api_keys')
      .select('id')
      .eq('tenant_id', tenantId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      logger.error('Error checking API key:', error)
      return NextResponse.json({ error: 'Failed to check API key' }, { status: 500 })
    }

    return NextResponse.json({ hasKey: !!data })
  } catch (error) {
    logger.error('Check key API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}