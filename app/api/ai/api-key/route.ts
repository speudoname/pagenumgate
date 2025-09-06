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
    const userRole = request.headers.get('x-user-role')
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can view API key settings
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('ai_api_keys')
      .select('id, provider, usage_count, tokens_used, last_used_at, created_at')
      .eq('tenant_id', tenantId)
      .single()

    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching API key info:', error)
      return NextResponse.json({ error: 'Failed to fetch API key info' }, { status: 500 })
    }

    return NextResponse.json({ 
      hasKey: !!data,
      keyInfo: data ? {
        provider: data.provider,
        usageCount: data.usage_count,
        tokensUsed: data.tokens_used,
        lastUsedAt: data.last_used_at,
        createdAt: data.created_at
      } : null
    })
  } catch (error) {
    logger.error('Get API key error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id')
    const userRole = request.headers.get('x-user-role')
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can set API keys
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { apiKey } = await request.json()

    if (!apiKey || !apiKey.startsWith('sk-')) {
      return NextResponse.json({ error: 'Invalid API key format' }, { status: 400 })
    }

    // Simple encryption (in production, use proper encryption)
    const encryptedKey = `encrypted:${apiKey}`

    // Upsert API key for tenant
    const { error } = await supabase
      .from('ai_api_keys')
      .upsert({
        tenant_id: tenantId,
        encrypted_key: encryptedKey,
        provider: 'anthropic',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id'
      })

    if (error) {
      logger.error('Error saving API key:', error)
      return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Save API key error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id')
    const userRole = request.headers.get('x-user-role')
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can delete API keys
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('ai_api_keys')
      .delete()
      .eq('tenant_id', tenantId)

    if (error) {
      logger.error('Error deleting API key:', error)
      return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Delete API key error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}