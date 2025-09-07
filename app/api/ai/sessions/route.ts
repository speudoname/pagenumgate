import { NextRequest, NextResponse } from 'next/server'
import { 
  getOrCreateSession, 
  getSessionMessages, 
  saveMessage,
  clearSessionHistory 
} from '@/lib/supabase/chatPersistence'

// GET /api/ai/sessions - Get or create session and return messages
export async function GET(request: NextRequest) {
  try {
    // For development, use default user/tenant IDs
    const userId = '6da127c2-83b0-4fed-afb9-fe70d3602bb6'
    const tenantId = '6da127c2-83b0-4fed-afb9-fe70d3602bb6'
    
    // Get or create session
    const session = await getOrCreateSession(userId, tenantId)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Failed to create or retrieve session' },
        { status: 500 }
      )
    }
    
    // Get messages for this session
    const messages = await getSessionMessages(session.id)
    
    return NextResponse.json({
      session,
      messages
    })
    
  } catch (error) {
    console.error('Session endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/ai/sessions - Save a message to the session
export async function POST(request: NextRequest) {
  try {
    const { sessionId, role, content, tools } = await request.json()
    
    if (!sessionId || !role || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, role, content' },
        { status: 400 }
      )
    }
    
    const message = await saveMessage(sessionId, role, content, tools)
    
    if (!message) {
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      )
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
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('id')
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      )
    }
    
    const success = await clearSessionHistory(sessionId)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to clear session history' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Clear history error:', error)
    return NextResponse.json(
      { error: 'Failed to clear history' },
      { status: 500 }
    )
  }
}