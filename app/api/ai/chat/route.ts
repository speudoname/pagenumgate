import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { simpleTools, executeSimpleTool } from '@/lib/ai/simple-tools'
import { buildContextualPrompt } from '@/lib/ai/system-prompt'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const maxDuration = 60 // 60 second timeout for Vercel

export async function POST(request: NextRequest) {
  try {
    const { message, currentFolder, selectedFile, sessionId, conversationHistory } = await request.json()
    
    // Check authentication and get tenant ID
    const { userId, orgId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const tenantId = orgId || userId
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