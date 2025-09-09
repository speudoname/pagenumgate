import { NextRequest, NextResponse } from 'next/server'
import { Storage } from '@/lib/kv/chat-storage'

// GET /api/ai/history - Get chat history for a page
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId')
    
    if (!pageId) {
      return NextResponse.json({ error: 'Page ID required' }, { status: 400 })
    }
    
    // Get tenant ID from proxy headers or use dev default
    const isProxied = request.headers.get('x-proxied-from') === 'numgate'
    let tenantId = '6da127c2-83b0-4fed-afb9-fe70d3602bb6' // Default for dev
    
    if (isProxied) {
      // Trust NUMgate's authentication
      tenantId = request.headers.get('x-tenant-id') || tenantId
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
    
    // Get tenant ID from proxy headers or use dev default
    const isProxied = request.headers.get('x-proxied-from') === 'numgate'
    let tenantId = '6da127c2-83b0-4fed-afb9-fe70d3602bb6' // Default for dev
    
    if (isProxied) {
      // Trust NUMgate's authentication
      tenantId = request.headers.get('x-tenant-id') || tenantId
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
    
    // Get tenant ID from proxy headers or use dev default
    const isProxied = request.headers.get('x-proxied-from') === 'numgate'
    let tenantId = '6da127c2-83b0-4fed-afb9-fe70d3602bb6' // Default for dev
    
    if (isProxied) {
      // Trust NUMgate's authentication
      tenantId = request.headers.get('x-tenant-id') || tenantId
    }
    
    await Storage.clearChat(tenantId, pageId)
    await Storage.clearOperations(tenantId, pageId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Clear history error:', error)
    return NextResponse.json({ error: 'Failed to clear history' }, { status: 500 })
  }
}