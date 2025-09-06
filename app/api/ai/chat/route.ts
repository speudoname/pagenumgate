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

    // Prepare lightweight system prompt
    const systemPrompt = `You are an intelligent AI assistant for page building and file management.

## 🔴 CRITICAL: Your Current Context
${contextType === 'folder' ? `
📁 FOLDER SELECTED: "${contextPath}"
**THIS IS YOUR PRIMARY WORKING DIRECTORY**
- ANY file operation defaults to THIS folder
- "create file" → creates in ${contextPath}/
- "delete all" → operates in ${contextPath}/
- ALWAYS use this folder unless user specifies different path
` : contextType === 'file' ? `
📄 FILE SELECTED: "${contextPath}"
**THIS IS YOUR PRIMARY WORKING FILE**
- "edit this" or "update" → modifies THIS file
- "add content" → adds to THIS file
- Always read THIS file before editing
` : `
🌐 ROOT LEVEL - No specific selection
- Look at the file browser to see what folder/file user is viewing
- Default to root operations
`}

## Your Task Execution Process
1. **ANALYZE**: What does the user want?
2. **CONTEXT**: Apply to selected folder/file FIRST
3. **PLAN**: Break down into specific tool calls
4. **EXECUTE**: Run ALL necessary tools in sequence
5. **VERIFY**: Ensure you completed everything

## MANDATORY Execution Rules
- **NEVER stop after just listing** - continue with the action
- **ALWAYS complete multi-step tasks** - if you list files to delete, then DELETE them
- **DEFAULT to selected context** - use ${contextPath || '/'} unless told otherwise
- **Chain tools properly** - read→edit, list→delete, etc.

## Your 25 Tools (use as many as needed)
- File Ops: create_file, edit_file, delete_file, read_file, list_files, create_folder, move_file
- DOM: update_section, get_preview_state, find_element, update_element, add_element, remove_element, inspect_element
- Page: add_section, apply_theme, update_layout, optimize_seo, add_component
- Business: add_webinar_registration, add_payment_form, add_lms_course_card, add_testimonial_section, add_opt_in_form, add_product_showcase

## Common Multi-Step Patterns
- "Delete all except X" → list_files → filter → delete_file (multiple times)
- "Edit and add content" → read_file → modify → edit_file
- "Create page with content" → create_file with full HTML
- "Update multiple files" → list → read each → edit each

## Remember
- You're intelligent - understand natural language
- You're thorough - complete ALL steps
- You're context-aware - use the selected folder/file
- You're persistent - don't stop until done

CURRENT WORKING CONTEXT: ${contextPath || 'root'}`
    
    // Prepare messages for Claude (no system role in messages)
    // Filter out system messages and empty content
    const messages = [
      ...(history || [])
        .filter((msg: any) => 
          msg.role !== 'system' && 
          msg.role !== 'status' && 
          msg.content && 
          msg.content.trim() !== ''
        )
        .map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
      {
        role: 'user' as const,
        content: message
      }
    ].filter(msg => msg.content && msg.content.trim() !== '') // Final safety filter

    // Create streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Declare variables at the top of the function for proper scope
          let fullContent = ''
          let toolsCalled: any[] = []
          
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

          // ACTION PLAN APPROACH: Generate complete plan first, then execute
          
          // Step 1: Ask Claude to generate an action plan with all tool calls
          const planResponse = await anthropic.messages.create({
            model: selectedModel,
            max_tokens: 4096,
            system: `${systemPrompt}

## CRITICAL: Action Plan Generation
You must respond with a structured action plan in JSON format.
Analyze the user's request and generate a complete plan with all necessary tool calls.
Include ALL parameters for each tool, using the context path when needed.

Respond ONLY with valid JSON in this format:
{
  "analysis": "Brief analysis of what the user wants",
  "plan": [
    {
      "step": 1,
      "description": "What this step does",
      "tool": "tool_name",
      "input": { /* all required parameters */ }
    }
  ],
  "summary": "What will be accomplished"
}

REMEMBER:
- Use contextPath (${contextPath || '/'}) as default for file operations
- Include ALL required parameters for each tool
- Chain operations properly (read before edit, list before delete, etc.)`,
            messages: [...messages, { role: 'user' as const, content: `Generate an action plan for: ${message}` }] as any,
            tools: [], // No tools in planning phase
          })

          // Extract the plan from Claude's response
          let actionPlan: any = null
          let planContent = ''
          
          if (planResponse.content && planResponse.content[0] && planResponse.content[0].type === 'text') {
            planContent = planResponse.content[0].text
            try {
              // Try to parse JSON from the response
              const jsonMatch = planContent.match(/\{[\s\S]*\}/)
              if (jsonMatch) {
                actionPlan = JSON.parse(jsonMatch[0])
              }
            } catch (e) {
              logger.error('Failed to parse action plan:', e)
            }
          }

          // If we couldn't get a valid plan, fall back to direct execution
          if (!actionPlan || !actionPlan.plan || !Array.isArray(actionPlan.plan)) {
            // Fallback: Try direct streaming approach with better prompting
            const response = await anthropic.messages.create({
              model: selectedModel,
              max_tokens: 4096,
              system: systemPrompt,
              messages: messages as any,
              tools: tools as any,
              stream: true,
            })

            // Reset variables for fallback execution
            fullContent = ''
            toolsCalled = []
            let currentToolBuffer = ''
            let currentToolIndex = -1

            for await (const chunk of response) {
              if (chunk.type === 'content_block_start') {
                if (chunk.content_block.type === 'text') {
                  currentToolIndex = -1
                } else if (chunk.content_block.type === 'tool_use') {
                  const tool = {
                    id: chunk.content_block.id,
                    name: chunk.content_block.name,
                    input: {}
                  }
                  toolsCalled.push(tool)
                  currentToolIndex = toolsCalled.length - 1
                  currentToolBuffer = ''
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_use', tool })}\n\n`))
                }
              } else if (chunk.type === 'content_block_delta') {
                if (chunk.delta.type === 'text_delta') {
                  const text = chunk.delta.text
                  fullContent += text
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: text })}\n\n`))
                } else if (chunk.delta.type === 'input_json_delta') {
                  if (currentToolIndex >= 0 && chunk.delta.partial_json) {
                    currentToolBuffer += chunk.delta.partial_json
                  }
                }
              } else if (chunk.type === 'content_block_stop') {
                if (currentToolIndex >= 0 && currentToolBuffer) {
                  try {
                    toolsCalled[currentToolIndex].input = JSON.parse(currentToolBuffer)
                    currentToolBuffer = ''
                    currentToolIndex = -1
                  } catch (parseError) {
                    logger.error('JSON parse error for tool:', toolsCalled[currentToolIndex]?.name, parseError)
                    toolsCalled[currentToolIndex].input = {}
                    currentToolBuffer = ''
                    currentToolIndex = -1
                  }
                }
              }
            }
          } else {
            // Execute the action plan
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'action_plan', 
              plan: actionPlan 
            })}\n\n`))

            // Send the analysis as content
            const planSummary = `📋 **Action Plan:**\n${actionPlan.analysis}\n\n**Steps to execute:**\n${actionPlan.plan.map((s: any) => `${s.step}. ${s.description}`).join('\n')}\n\n**Expected outcome:**\n${actionPlan.summary}`
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content: planSummary })}\n\n`))

            // Convert plan steps to tool calls with validation
            toolsCalled = actionPlan.plan.map((step: any) => {
              // Validate and enhance parameters based on context
              let enhancedInput = { ...step.input }
              
              // Add context path if missing and applicable
              if (contextPath && contextType) {
                // For file operations, ensure path uses context
                if (['create_file', 'edit_file', 'delete_file', 'read_file', 'list_files'].includes(step.tool)) {
                  // For create_file, ensure we have a filename not just a folder
                  if (step.tool === 'create_file') {
                    if (!enhancedInput.path || enhancedInput.path === '/' || enhancedInput.path.endsWith('/')) {
                      // If no filename provided, don't use just the folder path
                      // The AI should provide a full path with filename
                      console.warn('create_file needs a filename, not just folder path:', enhancedInput.path)
                    } else if (!enhancedInput.path.startsWith('/') && contextType === 'folder') {
                      // Relative path - prepend context folder
                      const folderPath = contextPath.endsWith('/') ? contextPath : `${contextPath}/`
                      enhancedInput.path = `${folderPath}${enhancedInput.path}`
                    }
                  } else {
                    // For other file operations
                    if (!enhancedInput.path || enhancedInput.path === '/') {
                      if (contextType === 'folder') {
                        enhancedInput.path = contextPath.endsWith('/') ? contextPath : `${contextPath}/`
                      } else if (contextType === 'file') {
                        enhancedInput.path = contextPath
                      }
                    } else if (!enhancedInput.path.startsWith('/') && contextType === 'folder') {
                      // Relative path - prepend context
                      enhancedInput.path = `${contextPath}/${enhancedInput.path}`
                    }
                  }
                }
                
                // For DOM tools, ensure path uses context if it's a file
                if (contextType === 'file' && step.tool.includes('element') || step.tool.includes('section')) {
                  if (!enhancedInput.path) {
                    enhancedInput.path = contextPath
                  }
                }
              }
              
              return {
                id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: step.tool,
                input: enhancedInput
              }
            })
            
            // fullContent is used later to save the assistant message
            fullContent = planSummary
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
                // Validate tool has input before executing
                if (!tool.input || Object.keys(tool.input).length === 0) {
                  logger.error(`Tool ${tool.name} has no input`)
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