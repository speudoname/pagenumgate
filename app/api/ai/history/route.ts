import { NextRequest, NextResponse } from 'next/server'
import { SafeStorage } from '@/lib/kv/chat-storage'
import { requireProxyAuth } from '@/lib/auth/proxy-auth'

// GET /api/ai/history - Get chat history for a page
export async function GET(request: NextRequest) {
  try {
    // Validate proxy authentication
    const auth = requireProxyAuth(request)
    const { tenantId } = auth
    
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId')
    
    if (!pageId) {
      return NextResponse.json({ error: 'Page ID required' }, { status: 400 })
    }
    
    const messages = await SafeStorage.getMessages(tenantId, pageId)
    const operations = await SafeStorage.getOperations(tenantId, pageId)
    
    return NextResponse.json({ 
      messages,
      operations,
      pageId,
      tenantId 
    })
  } catch (error) {
    console.error('History fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }
}

// POST /api/ai/history - Save a message
export async function POST(request: NextRequest) {
  try {
    // Validate proxy authentication
    const auth = requireProxyAuth(request)
    const { tenantId } = auth
    
    const { pageId, message } = await request.json()
    
    if (!pageId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    await SafeStorage.addMessage(tenantId, pageId, {
      ...message,
      id: message.id || `msg-${Date.now()}`,
      timestamp: new Date()
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Save message error:', error)
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }
}

// DELETE /api/ai/history - Clear history for a page
export async function DELETE(request: NextRequest) {
  try {
    // Validate proxy authentication
    const auth = requireProxyAuth(request)
    const { tenantId } = auth
    
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId')
    
    if (!pageId) {
      return NextResponse.json({ error: 'Page ID required' }, { status: 400 })
    }
    
    await SafeStorage.clearChat(tenantId, pageId)
    await SafeStorage.clearOperations(tenantId, pageId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Clear history error:', error)
    return NextResponse.json({ error: 'Failed to clear history' }, { status: 500 })
  }
}