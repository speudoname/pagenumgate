import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { simpleTools, executeSimpleTool } from '@/lib/ai/simple-tools'
import { buildContextualPrompt } from '@/lib/ai/system-prompt'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(request: NextRequest) {
  try {
    const { message, currentFolder, selectedFile, sessionId, conversationHistory } = await request.json()
    
    // Get tenant ID from JWT or use dev default
    const cookieStore = await cookies()
    const token = cookieStore.get('jwt-token')
    
    let tenantId = '6da127c2-83b0-4fed-afb9-fe70d3602bb6' // Default for dev
    
    if (token) {
      try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
        const verified = await jwtVerify(token.value, secret)
        const payload = verified.payload as any
        tenantId = payload.app_metadata?.tenant_id || payload.sub
      } catch (error) {
        console.log('Using default tenant for development')
      }
    }
    
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }
    
    // Build messages array with history
    const messages: any[] = []
    
    // Add conversation history if available
    if (conversationHistory && conversationHistory.length > 0) {
      // Include last 10 messages for context
      const recentHistory = conversationHistory.slice(-10)
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role,
          content: msg.content
        })
      }
    }
    
    // Add current message
    messages.push({ role: 'user', content: message })
    
    // Call Claude with contextual prompt and conversation history
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 4096,
      system: buildContextualPrompt(currentFolder, selectedFile),
      messages,
      tools: simpleTools as any
    })

    // Process the response
    const toolResults = []
    let assistantMessage = ''

    for (const block of response.content) {
      if (block.type === 'text') {
        assistantMessage += block.text
      } else if (block.type === 'tool_use') {
        // Execute the tool
        const result = await executeSimpleTool(
          block.name,
          block.input,
          tenantId,
          currentFolder
        )
        
        toolResults.push({
          tool: block.name,
          input: block.input,
          result
        })
      }
    }

    return NextResponse.json({
      message: assistantMessage,
      tools: toolResults
    })

  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process AI request' },
      { status: 500 }
    )
  }
}