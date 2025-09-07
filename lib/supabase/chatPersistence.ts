import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role for server-side operations
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
      db: {
        schema: 'pagebuilder' // Explicitly use pagebuilder schema
      }
    }
  )
}

export interface ChatSession {
  id: string
  tenant_id: string
  user_id: string
  folder_path: string
  started_at: string
  last_activity: string
  metadata: any
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  tools_used: any[]
  metadata: any
  created_at: string
}

// Get or create a chat session
export async function getOrCreateSession(
  userId: string,
  tenantId: string
): Promise<ChatSession | null> {
  const supabase = getSupabaseAdmin()
  
  try {
    // Try to get existing session
    const { data: existingSession, error: fetchError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .order('last_activity', { ascending: false })
      .limit(1)
      .single()
    
    if (existingSession && !fetchError) {
      // Update last activity
      await supabase
        .from('chat_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', existingSession.id)
      
      return existingSession
    }
    
    // Create new session if none exists
    const { data: newSession, error: createError } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        folder_path: '/',
        metadata: {}
      })
      .select()
      .single()
    
    if (createError) {
      console.error('Failed to create session:', createError)
      return null
    }
    
    return newSession
  } catch (error) {
    console.error('Session error:', error)
    return null
  }
}

// Get recent messages for a session
export async function getSessionMessages(
  sessionId: string,
  limit: number = 50
): Promise<ChatMessage[]> {
  const supabase = getSupabaseAdmin()
  
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit)
    
    if (error) {
      console.error('Failed to fetch messages:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Messages fetch error:', error)
    return []
  }
}

// Save a message to the session
export async function saveMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  tools?: any[]
): Promise<ChatMessage | null> {
  const supabase = getSupabaseAdmin()
  
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role,
        content,
        tools_used: tools || [],
        metadata: {}
      })
      .select()
      .single()
    
    if (error) {
      console.error('Failed to save message:', error)
      return null
    }
    
    // Update session last activity
    await supabase
      .from('chat_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', sessionId)
    
    return data
  } catch (error) {
    console.error('Save message error:', error)
    return null
  }
}

// Clear session history (optional)
export async function clearSessionHistory(sessionId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  
  try {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId)
    
    if (error) {
      console.error('Failed to clear history:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Clear history error:', error)
    return false
  }
}