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

function getErrorSuggestion(toolName: string, error: any): string {
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : ''
  
  if (errorMessage.includes('not found')) {
    return '💡 Check if the file path is correct and the file exists'
  }
  if (errorMessage.includes('permission')) {
    return '💡 You may not have permission to perform this operation'
  }
  if (errorMessage.includes('already exists')) {
    return '💡 Try using a different name or delete the existing file first'
  }
  if (errorMessage.includes('invalid path')) {
    return '💡 Make sure the path doesn\'t contain invalid characters or ".."'
  }
  if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
    return '💡 Network issue detected. Please try again'
  }
  
  // Tool-specific suggestions
  if (toolName === 'create_file') {
    return '💡 Check if the folder exists and you have write permissions'
  }
  if (toolName === 'delete_file') {
    return '💡 Make sure the file exists and is not being used'
  }
  if (toolName === 'move_file') {
    return '💡 Check both source and destination paths are valid'
  }
  
  return '💡 Please check your input and try again'
}

export async function POST(request: NextRequest) {
  try {
    // Get auth headers
    const tenantId = request.headers.get('x-tenant-id')
    const userId = request.headers.get('x-user-id')
    
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId, contextType, contextPath, message, history, model = 'claude-sonnet-4' } = await request.json()

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

    // Prepare system prompt
    const systemPrompt = `You are an AI-powered page builder assistant helping with file and page management.
    Current context: ${contextType} at path "${contextPath}".
    Tenant ID: ${tenantId}
    
    🎯 CRITICAL CONTEXT HANDLING:
    ${contextType === 'folder' ? `
    ⚠️ FOLDER CONTEXT MODE - ESSENTIAL RULES:
    • DEFAULT LOCATION: ALL file operations must happen in "${contextPath}" folder
    • When user says "create file X" → create "${contextPath}/X"
    • When user says "make a page" → create in "${contextPath}/[name].html"
    • When user says "list files" → list files in "${contextPath}"
    • When user says "here" → refers to "${contextPath}" folder
    • NEVER create files outside this folder unless explicitly requested with full path
    • If user provides ONLY filename (no path), prepend "${contextPath}/"
    • Example: "create contact page" → path should be "${contextPath}/contact.html"
    ` : `
    • Context: ${contextType === 'file' ? `Working on file: ${contextPath}` : 'Global context - working on tenant root'}
    `}
    
    🎯 CRITICAL TOOL USAGE INSTRUCTIONS:
    
    1. SMART PARAMETER EXTRACTION:
       • Extract ALL parameters from natural language
       • "create a page for [name]" → use name.html as filename
       • "make it [style]" → apply that design style
       • "add [component]" → include that element
       • NEVER call tools with empty/missing parameters
    
    2. CONTEXT AWARENESS:
       • Current file/folder is your default context
       • "this page" = current context path
       • "here" = current directory (${contextPath})
       • Remember previous actions in conversation
    
    3. INTELLIGENT DEFAULTS:
       • Pages → .html extension
       • Styles → .css extension  
       • Scripts → .js extension
       • Missing filename → generate from context
       • Missing content → generate complete, valid content
    
    4. TOOL SELECTION PATTERNS:
       File Operations (7 tools):
       • "create/make/build" → create_file
       • "change/update/modify" → edit_file
       • "delete/remove" → delete_file
       • "show/open/view" → read_file
       • "list/what's here" → list_files
       • "folder/directory" → create_folder
       • "rename/move" → move_file
       
       DOM Manipulation (7 tools):
       • "update section/header/footer" → update_section
       • "preview/analyze" → get_preview_state
       • "find text" → find_element
       • "change element" → update_element
       • "add element" → add_element
       • "remove element" → remove_element
       • "inspect" → inspect_element
       
       Page Building (5 tools):
       • "add hero/features" → add_section
       • "apply theme/style" → apply_theme
       • "layout/columns" → update_layout
       • "SEO/meta" → optimize_seo
       • "component/widget" → add_component
       
       Business Integration (6 tools):
       • "webinar/registration" → add_webinar_registration
       • "payment/checkout" → add_payment_form
       • "courses/LMS" → add_lms_course_card
       • "testimonials/reviews" → add_testimonial_section
       • "newsletter/email" → add_opt_in_form
       • "products/shop" → add_product_showcase
    
    5. CONTENT GENERATION RULES:
       • HTML files: Complete DOCTYPE, semantic HTML5, responsive
       • Styles: brutal=bold/harsh, modern=gradients, minimal=clean
       • Always include Tailwind CSS classes for styling
       • Make content professional and complete
    
    6. EXAMPLES:
       • "create landing page for sara" → create_file(path="sara.html", content=<full HTML>)
       • "make it brutal" → apply_theme(theme="neo-brutalist") 
       • "add contact form" → add_section(section_type="contact")
       • "3 column layout" → update_layout(layout="three-columns")
       • "add payment for course" → add_payment_form(product_id="course")
    
    ⚠️ REMEMBER: 
    - Extract parameters from context, don't ask user
    - Generate missing info intelligently
    - Use conversation history for context
    - ALWAYS provide ALL required parameters`
    
    // Prepare messages for Claude (no system role in messages)
    const messages = [
      ...(history || []).filter((msg: any) => msg.role !== 'system').map((msg: any) => ({
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
          // IMPORTANT: Using Claude 4 and Opus 4.1 ONLY - NO Claude 3.5!
          const modelMapping: Record<string, string> = {
            'claude-sonnet-4': 'claude-sonnet-4-20250514', // Claude Sonnet 4 (Released May 2025)
            'claude-opus-4-1': 'claude-opus-4-1-20250805', // Claude Opus 4.1 (Released August 5, 2025)
            // Map any legacy references to Claude 4 models
            'claude-3-5-sonnet-latest': 'claude-sonnet-4-20250514', // Redirect to Sonnet 4
            'claude-3-opus-latest': 'claude-opus-4-1-20250805' // Redirect to Opus 4.1
          }

          const selectedModel = modelMapping[model] || 'claude-sonnet-4-20250514' // Default to Sonnet 4

          // Create message with Claude
          const response = await anthropic.messages.create({
            model: selectedModel,
            max_tokens: 4096,
            system: systemPrompt, // Pass system as a parameter, not in messages
            messages: messages as any,
            tools: tools as any, // Cast to any since our Tool interface is compatible
            stream: true,
          })

          let fullContent = ''
          let toolsCalled: any[] = []
          let toolInputBuffers: string[] = [] // Buffer for accumulating tool inputs

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
                toolInputBuffers.push('') // Initialize buffer for this tool
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_use', tool })}\n\n`))
              }
            } else if (chunk.type === 'content_block_delta') {
              if (chunk.delta.type === 'text_delta') {
                const text = chunk.delta.text
                fullContent += text
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: text })}\n\n`))
              } else if (chunk.delta.type === 'input_json_delta') {
                // Tool input being streamed - accumulate the JSON string
                const toolIndex = toolsCalled.length - 1
                if (toolIndex >= 0 && chunk.delta.partial_json) {
                  toolInputBuffers[toolIndex] += chunk.delta.partial_json
                }
              }
            } else if (chunk.type === 'content_block_stop') {
              // Content block finished - parse complete tool input if it's a tool
              // The most recent tool is the last one in the array
              const toolIndex = toolsCalled.length - 1
              if (toolIndex >= 0 && toolInputBuffers[toolIndex]) {
                try {
                  const completeJson = toolInputBuffers[toolIndex]
                  logger.log(`Parsing tool input for ${toolsCalled[toolIndex].name}: ${completeJson}`)
                  if (completeJson) {
                    toolsCalled[toolIndex].input = JSON.parse(completeJson)
                    logger.log(`Parsed input:`, toolsCalled[toolIndex].input)
                  }
                } catch (parseError) {
                  logger.error('Error parsing tool input JSON:', parseError, 'JSON:', toolInputBuffers[toolIndex])
                  toolsCalled[toolIndex].input = {}
                }
              }
            } else if (chunk.type === 'message_stop') {
              // Message complete
            }
          }

          // Execute any tool calls with detailed status updates
          if (toolsCalled.length > 0) {
            for (const tool of toolsCalled) {
              const startTime = Date.now()
              
              // Send tool execution start status
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'tool_status', 
                tool: tool.name,
                status: 'starting',
                message: `🔧 Starting ${tool.name}...`,
                input: tool.input
              })}\n\n`))

              try {
                // Enhanced debugging
                logger.log('=== TOOL EXECUTION DEBUG ===')
                logger.log(`Tool name: ${tool.name}`)
                logger.log(`Tool input:`, JSON.stringify(tool.input, null, 2))
                logger.log(`Tool object:`, JSON.stringify(tool, null, 2))
                logger.log(`Tenant ID: ${tenantId}`)
                logger.log(`User ID: ${userId}`)
                
                // Validate tool has input before executing or showing progress
                if (!tool.input || Object.keys(tool.input).length === 0) {
                  logger.error(`Tool ${tool.name} has no input. Tool object:`, tool)
                  throw new Error(`Tool ${tool.name} called without required input`)
                }
                
                // Send detailed progress updates based on tool type
                if (tool.name === 'create_file') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'tool_progress',
                    tool: tool.name,
                    message: `📝 Creating file: ${tool.input?.path || 'new file'}`
                  })}\n\n`))
                } else if (tool.name === 'edit_file') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'tool_progress',
                    tool: tool.name,
                    message: `✏️ Editing file: ${tool.input?.path || 'file'}`
                  })}\n\n`))
                } else if (tool.name === 'delete_file') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'tool_progress',
                    tool: tool.name,
                    message: `🗑️ Deleting: ${tool.input?.path || 'file'}`
                  })}\n\n`))
                } else if (tool.name === 'list_files') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'tool_progress',
                    tool: tool.name,
                    message: `📂 Listing files in: ${tool.input?.path || 'current directory'}`
                  })}\n\n`))
                }
                
                const result = await executeToolCall(tool, tenantId, userId)
                const executionTime = Date.now() - startTime
                
                // Log tool execution
                await supabase
                  .from('ai_tool_executions')
                  .insert({
                    session_id: currentSessionId,
                    message_id: null,
                    tool_name: tool.name,
                    tool_input: tool.input,
                    tool_output: result,
                    success: true,
                    execution_time_ms: executionTime,
                  })

                // Send detailed tool result
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'tool_result', 
                  tool: tool.name,
                  status: 'completed',
                  result,
                  executionTime,
                  message: `✅ ${tool.name} completed in ${executionTime}ms`
                })}\n\n`))
              } catch (error) {
                const executionTime = Date.now() - startTime
                const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                
                logger.error('Tool execution error:', {
                  tool: tool.name,
                  input: tool.input,
                  error: errorMessage
                })
                
                // Log failed tool execution
                await supabase
                  .from('ai_tool_executions')
                  .insert({
                    session_id: currentSessionId,
                    message_id: null,
                    tool_name: tool.name,
                    tool_input: tool.input,
                    success: false,
                    error_message: errorMessage,
                    execution_time_ms: executionTime,
                  })

                // Send detailed error with input for debugging
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: 'tool_error',
                  tool: tool.name,
                  input: tool.input,
                  error: errorMessage,
                  suggestion: getErrorSuggestion(tool.name, error),
                  executionTime
                })}\n\n`))
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