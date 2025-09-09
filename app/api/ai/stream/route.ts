import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Storage } from '@/lib/kv/chat-storage'
import { simpleTools, executeSimpleTool } from '@/lib/ai/simple-tools'
import { buildContextualPrompt } from '@/lib/ai/system-prompt'
import { requireProxyAuth } from '@/lib/auth/proxy-auth'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const maxDuration = 60

interface PageContext {
  pageId: string
  currentHTML: string
  selectedElement?: string
  folderPath: string
}

export async function POST(request: NextRequest) {
  try {
    // Validate proxy authentication
    const auth = requireProxyAuth(request)
    const { tenantId } = auth
    
    const { 
      message, 
      pageContext,
      conversationHistory = []
    } = await request.json()

    if (!message || !pageContext) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Build system prompt with page context
    const systemPrompt = `
${buildContextualPrompt(pageContext.folderPath, null)}

CURRENT PAGE STATE:
You are currently editing this HTML page:
<current_page>
${pageContext.currentHTML || '<html><body></body></html>'}
</current_page>

${pageContext.selectedElement ? `
USER HAS SELECTED THIS ELEMENT:
${pageContext.selectedElement}
When the user refers to "this" or "the selected element", they mean the above element.
` : ''}

IMPORTANT INSTRUCTIONS:
1. You can see the current state of the page above
2. When making changes, be aware of existing styles and structure
3. Maintain consistency with the existing design
4. If the user asks you to change something, make sure you understand what element they're referring to
5. Always provide helpful feedback about what you're doing
`

    // Build messages array with history
    const messages: any[] = []
    
    // Add conversation history if available
    if (conversationHistory && conversationHistory.length > 0) {
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

    // Call Claude with OPUS 4.1 model
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805', // CRITICAL: Using Claude Opus 4.1 as required!
      max_tokens: 4096,
      system: systemPrompt,
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
          pageContext.folderPath
        )
        
        toolResults.push({
          tool: block.name,
          input: block.input,
          result
        })
      }
    }

    // Save to KV storage
    const chatMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant' as const,
      content: assistantMessage,
      timestamp: new Date(),
      tools: toolResults
    }
    
    await Storage.addMessage(tenantId, pageContext.pageId, chatMessage)
    
    // Track operations if any tools were used
    if (toolResults.length > 0) {
      for (const tool of toolResults) {
        if (['create_file', 'edit_file', 'delete_file'].includes(tool.tool)) {
          const input = tool.input as any
          const operation = {
            id: `op-${Date.now()}`,
            type: tool.tool.replace('_file', '') as any,
            target: input.path || input.file_path,
            changes: input,
            timestamp: new Date(),
            revertible: true
          }
          await Storage.addOperation(tenantId, pageContext.pageId, operation)
        }
      }
    }

    return NextResponse.json({
      message: assistantMessage,
      tools: toolResults
    })

  } catch (error) {
    console.error('AI error:', error)
    return NextResponse.json(
      { error: 'Failed to process AI request' },
      { status: 500 }
    )
  }
}