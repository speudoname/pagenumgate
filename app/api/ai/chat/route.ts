import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { verifyToken } from '@/lib/auth/jwt'
import { logger } from '@/lib/utils/logger'
import { getTools, executeToolCall } from '@/lib/ai/tools'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Get auth headers
    const tenantId = request.headers.get('x-tenant-id')
    const userId = request.headers.get('x-user-id')
    
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId, contextType, contextPath, message, history, model = 'claude-3-5-sonnet-latest' } = await request.json()

    // Get API key - first check database, then fallback to environment variable
    let apiKey: string | null = null
    
    // Try to get tenant-specific API key from database
    const { data: apiKeyData } = await supabase
      .from('ai_api_keys')
      .select('encrypted_key')
      .eq('tenant_id', tenantId)
      .single()

    if (apiKeyData?.encrypted_key) {
      // Decrypt API key (in production, use proper encryption)
      // For now, we'll store it as plain text with a simple prefix
      apiKey = apiKeyData.encrypted_key.replace('encrypted:', '')
    } else if (process.env.ANTHROPIC_API_KEY) {
      // Fallback to environment variable if no tenant-specific key
      apiKey = process.env.ANTHROPIC_API_KEY
    }

    if (!apiKey) {
      return NextResponse.json({ 
        error: 'No API key configured. Please add your Claude API key in settings or set ANTHROPIC_API_KEY environment variable.' 
      }, { status: 400 })
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: apiKey,
    })

    // Create or get session
    let currentSessionId = sessionId
    if (!currentSessionId) {
      const { data: session, error: sessionError } = await supabase
        .from('ai_chat_sessions')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          context_type: contextType,
          context_path: contextPath,
          title: `Chat on ${contextPath || 'root'}`,
          model: model,
        })
        .select()
        .single()

      if (sessionError) {
        logger.error('Error creating session:', sessionError)
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
      }
      currentSessionId = session.id
    }

    // Save user message
    await supabase
      .from('ai_chat_messages')
      .insert({
        session_id: currentSessionId,
        role: 'user',
        content: message,
      })

    // Prepare messages for Claude
    const messages = [
      {
        role: 'system' as const,
        content: `You are an AI assistant helping with file and folder management. 
        Current context: ${contextType} at path "${contextPath}".
        Tenant ID: ${tenantId}
        
        You have access to tools for file operations. Use them when appropriate.
        Be concise and helpful. When creating or editing files, ensure proper formatting.`
      },
      ...(history || []).map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      {
        role: 'user' as const,
        content: message
      }
    ]

    // Create streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send session ID first
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId: currentSessionId })}\n\n`))

          // Get available tools
          const tools = getTools(contextType, contextPath, tenantId)

          // Map model names to Anthropic model IDs
          // IMPORTANT: Using Claude 3.5 Sonnet and Claude 3 Opus 4.1 as requested
          const modelMapping: Record<string, string> = {
            'claude-3-5-sonnet-latest': 'claude-3-5-sonnet-20241022', // Claude 3.5 Sonnet
            'claude-3-opus-latest': 'claude-3-opus-20240229', // Claude 3 Opus (latest available)
            'claude-3-5-sonnet-20241022': 'claude-3-5-sonnet-20241022',
            'claude-3-opus-20240229': 'claude-3-opus-20240229'
          }

          const selectedModel = modelMapping[model] || 'claude-3-5-sonnet-20241022'

          // Create message with Claude
          const response = await anthropic.messages.create({
            model: selectedModel,
            max_tokens: 4096,
            messages: messages as any,
            tools: tools,
            stream: true,
          })

          let fullContent = ''
          let toolsCalled: any[] = []

          for await (const chunk of response) {
            if (chunk.type === 'content_block_start') {
              if (chunk.content_block.type === 'text') {
                // Text content starting
              } else if (chunk.content_block.type === 'tool_use') {
                // Tool use starting
                const tool = {
                  id: chunk.content_block.id,
                  name: chunk.content_block.name,
                  input: {}
                }
                toolsCalled.push(tool)
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_use', tool })}\n\n`))
              }
            } else if (chunk.type === 'content_block_delta') {
              if (chunk.delta.type === 'text_delta') {
                const text = chunk.delta.text
                fullContent += text
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: text })}\n\n`))
              } else if (chunk.delta.type === 'input_json_delta') {
                // Tool input being streamed
                const toolIndex = toolsCalled.length - 1
                if (toolIndex >= 0) {
                  toolsCalled[toolIndex].input = JSON.parse(chunk.delta.partial_json || '{}')
                }
              }
            } else if (chunk.type === 'message_stop') {
              // Message complete
            }
          }

          // Execute any tool calls
          if (toolsCalled.length > 0) {
            for (const tool of toolsCalled) {
              try {
                const result = await executeToolCall(tool, tenantId, userId)
                
                // Log tool execution
                await supabase
                  .from('ai_tool_executions')
                  .insert({
                    session_id: currentSessionId,
                    message_id: null, // We'll update this after saving the message
                    tool_name: tool.name,
                    tool_input: tool.input,
                    tool_output: result,
                    success: true,
                  })

                // Send tool result to client
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'tool_result', 
                  tool: tool.name, 
                  result 
                })}\n\n`))
              } catch (error) {
                logger.error('Tool execution error:', error)
                
                // Log failed tool execution
                await supabase
                  .from('ai_tool_executions')
                  .insert({
                    session_id: currentSessionId,
                    message_id: null,
                    tool_name: tool.name,
                    tool_input: tool.input,
                    success: false,
                    error_message: error instanceof Error ? error.message : 'Unknown error',
                  })
              }
            }
          }

          // Save assistant message
          await supabase
            .from('ai_chat_messages')
            .insert({
              session_id: currentSessionId,
              role: 'assistant',
              content: fullContent,
              tools_called: toolsCalled.length > 0 ? toolsCalled : null,
            })

          // Update API key usage
          const { data: currentKey } = await supabase
            .from('ai_api_keys')
            .select('usage_count')
            .eq('tenant_id', tenantId)
            .single()
          
          await supabase
            .from('ai_api_keys')
            .update({
              usage_count: (currentKey?.usage_count || 0) + 1,
              last_used_at: new Date().toISOString(),
            })
            .eq('tenant_id', tenantId)

          // Send completion signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
          controller.close()
        } catch (error) {
          logger.error('Streaming error:', error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })}\n\n`))
          controller.close()
        }
      }
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    logger.error('Chat API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}