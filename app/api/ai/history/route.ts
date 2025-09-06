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
    const userId = request.headers.get('x-user-id')
    
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const contextType = searchParams.get('contextType')
    const contextPath = searchParams.get('contextPath') || ''

    // Get or create session for this context
    const { data: sessions, error: sessionError } = await supabase
      .from('ai_chat_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('context_type', contextType)
      .eq('context_path', contextPath)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (sessionError) {
      logger.error('Error fetching session:', sessionError)
      return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
    }

    const session = sessions?.[0]

    if (!session) {
      // No existing session
      return NextResponse.json({ session: null, messages: [] })
    }

    // Get messages for this session
    const { data: messages, error: messagesError } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })

    if (messagesError) {
      logger.error('Error fetching messages:', messagesError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    return NextResponse.json({
      session,
      messages: messages || []
    })
  } catch (error) {
    logger.error('History API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id')
    const userId = request.headers.get('x-user-id')
    
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId, contextType, contextPath } = await request.json()

    if (sessionId) {
      // Delete specific session
      const { error } = await supabase
        .from('ai_chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('tenant_id', tenantId)

      if (error) {
        logger.error('Error deleting session:', error)
        return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
      }
    } else if (contextType && contextPath !== undefined) {
      // Delete all sessions for this context
      const { error } = await supabase
        .from('ai_chat_sessions')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('context_type', contextType)
        .eq('context_path', contextPath)

      if (error) {
        logger.error('Error deleting sessions:', error)
        return NextResponse.json({ error: 'Failed to delete sessions' }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Delete history API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}