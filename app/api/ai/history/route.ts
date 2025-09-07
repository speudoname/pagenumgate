import { NextRequest, NextResponse } from 'next/server'
import { Storage } from '@/lib/kv/chat-storage'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

// GET /api/ai/history - Get chat history for a page
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId')
    
    if (!pageId) {
      return NextResponse.json({ error: 'Page ID required' }, { status: 400 })
    }
    
    // Get tenant ID
    const cookieStore = await cookies()
    const token = cookieStore.get('jwt-token')
    let tenantId = '6da127c2-83b0-4fed-afb9-fe70d3602bb6'
    
    if (token) {
      try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
        const verified = await jwtVerify(token.value, secret)
        const payload = verified.payload as any
        tenantId = payload.app_metadata?.tenant_id || payload.sub
      } catch {}
    }
    
    const messages = await Storage.getMessages(tenantId, pageId)
    const operations = await Storage.getOperations(tenantId, pageId)
    
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
    const { pageId, message } = await request.json()
    
    if (!pageId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    // Get tenant ID
    const cookieStore = await cookies()
    const token = cookieStore.get('jwt-token')
    let tenantId = '6da127c2-83b0-4fed-afb9-fe70d3602bb6'
    
    if (token) {
      try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
        const verified = await jwtVerify(token.value, secret)
        const payload = verified.payload as any
        tenantId = payload.app_metadata?.tenant_id || payload.sub
      } catch {}
    }
    
    await Storage.addMessage(tenantId, pageId, {
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
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId')
    
    if (!pageId) {
      return NextResponse.json({ error: 'Page ID required' }, { status: 400 })
    }
    
    // Get tenant ID
    const cookieStore = await cookies()
    const token = cookieStore.get('jwt-token')
    let tenantId = '6da127c2-83b0-4fed-afb9-fe70d3602bb6'
    
    if (token) {
      try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
        const verified = await jwtVerify(token.value, secret)
        const payload = verified.payload as any
        tenantId = payload.app_metadata?.tenant_id || payload.sub
      } catch {}
    }
    
    await Storage.clearChat(tenantId, pageId)
    await Storage.clearOperations(tenantId, pageId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Clear history error:', error)
    return NextResponse.json({ error: 'Failed to clear history' }, { status: 500 })
  }
}