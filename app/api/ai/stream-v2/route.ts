import { NextRequest } from 'next/server'
import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { Storage } from '@/lib/kv/chat-storage'
import { simpleTools, executeSimpleTool } from '@/lib/ai/simple-tools'
import { buildContextualPrompt } from '@/lib/ai/system-prompt'
import { requireProxyAuth } from '@/lib/auth/proxy-auth'

export const maxDuration = 60

// Create Anthropic instance with the AI SDK
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

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
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
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

    // Convert tools to AI SDK format  
    const aiTools = Object.fromEntries(
      simpleTools.map(t => [
        t.name,
        {
          description: t.description,
          parameters: t.input_schema,
          execute: async (params: any) => {
            const result = await executeSimpleTool(
              t.name,
              params,
              tenantId,
              pageContext.folderPath
            )
            return result
          }
        }
      ])
    )

    // Stream the response using Claude Opus 4.1
    const result = await streamText({
      model: anthropic('claude-opus-4-1-20250805'), // CRITICAL: Using Claude Opus 4.1!
      system: systemPrompt,
      messages,
      // tools: aiTools, // Temporarily disabled due to type issues
      onFinish: async ({ text, toolCalls }) => {
        // Save to KV storage after streaming completes
        const chatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant' as const,
          content: text,
          timestamp: new Date(),
          tools: toolCalls
        }
        
        await Storage.addMessage(tenantId, pageContext.pageId, chatMessage)
        
        // Track operations if any tools were used
        if (toolCalls && toolCalls.length > 0) {
          for (const call of toolCalls) {
            if (['create_file', 'edit_file', 'delete_file'].includes(call.toolName)) {
              const args = (call as any).args || {}
              const operation = {
                id: `op-${Date.now()}`,
                type: call.toolName.replace('_file', '') as any,
                target: args.path || args.file_path,
                changes: args,
                timestamp: new Date(),
                revertible: true
              }
              await Storage.addOperation(tenantId, pageContext.pageId, operation)
            }
          }
        }
      }
    })

    // Return the streaming response
    return result.toTextStreamResponse()

  } catch (error) {
    console.error('AI streaming error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process AI request' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}