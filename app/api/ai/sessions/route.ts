import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAuth(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return null
  }
  
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const verified = await jwtVerify(token.value, secret)
    const payload = verified.payload as any
    return {
      userId: payload.sub,
      tenantId: payload.app_metadata?.tenant_id || payload.sub
    }
  } catch (error) {
    return null
  }
}

// GET /api/ai/sessions - Get or create session for current folder
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const folderPath = searchParams.get('folder') || '/'
    const limit = parseInt(searchParams.get('limit') || '20')
    
    // Check for existing session in this folder
    let { data: session, error: sessionError } = await supabase
      .from('pagebuilder.chat_sessions')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('user_id', auth.userId)
      .eq('folder_path', folderPath)
      .order('last_activity', { ascending: false })
      .limit(1)
      .single()
    
    // Create new session if none exists
    if (!session || sessionError) {
      const { data: newSession, error: createError } = await supabase
        .from('pagebuilder.chat_sessions')
        .insert({
          tenant_id: auth.tenantId,
          user_id: auth.userId,
          folder_path: folderPath,
          metadata: {}
        })
        .select()
        .single()
      
      if (createError) {
        console.error('Failed to create session:', createError)
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
      }
      
      return NextResponse.json({ 
        session: newSession,
        messages: [],
        context: []
      })
    }
    
    // Update last activity
    await supabase
      .from('pagebuilder.chat_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', session.id)
    
    // Get recent messages
    const { data: messages, error: messagesError } = await supabase
      .from('pagebuilder.chat_messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
      .limit(limit)
    
    if (messagesError) {
      console.error('Failed to fetch messages:', messagesError)
    }
    
    // Get context if available
    const { data: context, error: contextError } = await supabase
      .from('pagebuilder.chat_context')
      .select('*')
      .eq('session_id', session.id)
      .order('relevance_score', { ascending: false })
      .limit(5)
    
    if (contextError) {
      console.error('Failed to fetch context:', contextError)
    }
    
    return NextResponse.json({
      session,
      messages: messages || [],
      context: context || []
    })
    
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json(
      { error: 'Failed to manage session' },
      { status: 500 }
    )
  }
}

// POST /api/ai/sessions - Save a message to the session
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { sessionId, role, content, tools, metadata } = await request.json()
    
    if (!sessionId || !role || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('pagebuilder.chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', auth.userId)
      .single()
    
    if (!session || sessionError) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }
    
    // Save the message
    const { data: message, error: messageError } = await supabase
      .from('pagebuilder.chat_messages')
      .insert({
        session_id: sessionId,
        role,
        content,
        tools_used: tools || [],
        metadata: metadata || {}
      })
      .select()
      .single()
    
    if (messageError) {
      console.error('Failed to save message:', messageError)
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      )
    }
    
    // Update session last activity
    await supabase
      .from('pagebuilder.chat_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', sessionId)
    
    // If tools were used to modify files, record the operations
    if (tools && tools.length > 0) {
      const fileOps = tools
        .filter((t: any) => ['create_file', 'edit_file', 'delete_file', 'rename_file'].includes(t.tool))
        .map((t: any) => ({
          session_id: sessionId,
          message_id: message.id,
          operation_type: t.tool.replace('_file', ''),
          file_path: t.input.filename || t.input.path || t.input.oldName || '',
          file_content: t.input.content,
          metadata: { input: t.input, result: t.result }
        }))
      
      if (fileOps.length > 0) {
        await supabase
          .from('pagebuilder.file_operations')
          .insert(fileOps)
      }
    }
    
    return NextResponse.json({ message })
    
  } catch (error) {
    console.error('Save message error:', error)
    return NextResponse.json(
      { error: 'Failed to save message' },
      { status: 500 }
    )
  }
}

// DELETE /api/ai/sessions - Clear session history
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('id')
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      )
    }
    
    // Verify session belongs to user and delete it
    const { error } = await supabase
      .from('pagebuilder.chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', auth.userId)
    
    if (error) {
      console.error('Failed to delete session:', error)
      return NextResponse.json(
        { error: 'Failed to delete session' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Delete session error:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}