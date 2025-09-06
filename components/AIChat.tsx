'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getApiUrl } from '@/lib/utils/api'

interface AIChatProps {
  contextType: 'file' | 'folder' | 'global'
  contextPath: string
  tenantId: string
  onClose?: () => void
}

interface ToolCall {
  name: string
  input: any
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
  startTime?: Date
  endTime?: Date
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'status'
  content: string
  tools_called?: ToolCall[]
  timestamp: Date
  status?: 'thinking' | 'processing' | 'complete' | 'error'
}

interface ChatSession {
  id: string
  messages: Message[]
}

export default function AIChat({ contextType, contextPath, tenantId, onClose }: AIChatProps) {
  // Store sessions per context in a map
  const [sessions, setSessions] = useState<Map<string, { 
    sessionId: string | null, 
    messages: Message[] 
  }>>(new Map())
  
  // Get the current context key
  const contextKey = `${contextType}:${contextPath || 'global'}`
  
  // Get or create session for current context
  const currentSession = sessions.get(contextKey) || { sessionId: null, messages: [] }
  const messages = currentSession.messages
  const sessionId = currentSession.sessionId
  
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet-4')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // Helper functions to update current session
  const setMessages = (newMessages: Message[] | ((prev: Message[]) => Message[])) => {
    setSessions(prev => {
      const newSessions = new Map(prev)
      const current = newSessions.get(contextKey) || { sessionId: null, messages: [] }
      const updatedMessages = typeof newMessages === 'function' 
        ? newMessages(current.messages) 
        : newMessages
      newSessions.set(contextKey, { ...current, messages: updatedMessages })
      return newSessions
    })
  }
  
  const setSessionId = (id: string | null) => {
    setSessions(prev => {
      const newSessions = new Map(prev)
      const current = newSessions.get(contextKey) || { sessionId: null, messages: [] }
      newSessions.set(contextKey, { ...current, sessionId: id })
      return newSessions
    })
  }

  useEffect(() => {
    loadChatHistory()
    checkApiKey()
  }, [contextType, contextPath])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const checkApiKey = async () => {
    try {
      const response = await fetch(getApiUrl('/api/ai/check-key'))
      const data = await response.json()
      setHasApiKey(data.hasKey)
    } catch (error) {
      console.error('Error checking API key:', error)
      setHasApiKey(false)
    }
  }

  const loadChatHistory = async () => {
    try {
      const response = await fetch(getApiUrl(`/api/ai/history?contextType=${contextType}&contextPath=${encodeURIComponent(contextPath)}`))
      if (response.ok) {
        const data = await response.json()
        if (data.session) {
          setSessionId(data.session.id)
          setMessages(data.messages || [])
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
    }
  }

  const addStatusMessage = (content: string, status?: Message['status']) => {
    const statusMessage: Message = {
      id: `status-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'status',
      content,
      timestamp: new Date(),
      status: status || 'processing'
    }
    setMessages(prev => [...prev, statusMessage])
    return statusMessage.id
  }

  const updateStatusMessage = (id: string, content: string, status?: Message['status']) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, content, status } : msg
    ))
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setIsStreaming(true)

    // Add initial status message
    const statusId = addStatusMessage('🤔 Thinking about your request...', 'thinking')

    try {
      abortControllerRef.current = new AbortController()
      
      // Update status with more detail
      setTimeout(() => updateStatusMessage(statusId, '🔍 Analyzing context and available tools...', 'processing'), 500)
      setTimeout(() => updateStatusMessage(statusId, '📡 Connecting to Claude AI...', 'processing'), 1000)
      
      const response = await fetch(getApiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          contextType,
          contextPath,
          message: userMessage.content,
          history: messages.filter(m => m.role === 'user' || m.role === 'assistant'),
          model: selectedModel
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      // Remove status message before showing assistant response
      setMessages(prev => prev.filter(msg => msg.id !== statusId))

      // Handle streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        status: 'processing',
        tools_called: []
      }

      setMessages(prev => [...prev, assistantMessage])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'content') {
                assistantMessage.content += data.content
                assistantMessage.status = 'processing'
                setMessages(prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1] = { ...assistantMessage }
                  return newMessages
                })
              } else if (data.type === 'tool_use') {
                // Add tool execution status
                const tool: ToolCall = {
                  ...data.tool,
                  status: 'pending',
                  startTime: new Date()
                }
                assistantMessage.tools_called?.push(tool)
                
                // Update assistant message
                setMessages(prev => {
                  const newMessages = [...prev]
                  const assistantIndex = newMessages.findIndex(m => m.id === assistantMessage.id)
                  if (assistantIndex >= 0) {
                    newMessages[assistantIndex] = { ...assistantMessage }
                  }
                  return newMessages
                })
              } else if (data.type === 'tool_status') {
                // New detailed tool status from API
                const statusText = data.message || `🔧 ${data.tool}: ${data.status}`
                if (data.status === 'starting') {
                  addStatusMessage(statusText, 'processing')
                } else if (data.status === 'completed') {
                  addStatusMessage(`${statusText}\n⏱️ ${data.executionTime}ms`, 'complete')
                }
              } else if (data.type === 'tool_progress') {
                // Tool progress updates
                addStatusMessage(data.message, 'processing')
              } else if (data.type === 'tool_error') {
                // Tool error with suggestions
                addStatusMessage(
                  `❌ ${data.tool} failed: ${data.error}\n${data.suggestion}\n⏱️ ${data.executionTime}ms`,
                  'error'
                )
              } else if (data.type === 'tool_result') {
                // Update tool status
                const toolIndex = assistantMessage.tools_called?.findIndex(t => t.name === data.tool)
                if (toolIndex !== undefined && toolIndex >= 0 && assistantMessage.tools_called) {
                  assistantMessage.tools_called[toolIndex].status = data.status === 'completed' ? 'completed' : 'failed'
                  assistantMessage.tools_called[toolIndex].result = data.result
                  assistantMessage.tools_called[toolIndex].endTime = new Date()
                }
                
                // Show detailed result if available
                if (data.result && typeof data.result === 'object') {
                  if (data.result.filesCreated || data.result.filesModified || data.result.filesDeleted) {
                    let resultMsg = '📊 Operation Summary:\n'
                    if (data.result.filesCreated) resultMsg += `  • Created: ${data.result.filesCreated}\n`
                    if (data.result.filesModified) resultMsg += `  • Modified: ${data.result.filesModified}\n`
                    if (data.result.filesDeleted) resultMsg += `  • Deleted: ${data.result.filesDeleted}\n`
                    addStatusMessage(resultMsg, 'complete')
                  }
                }
              } else if (data.type === 'session') {
                setSessionId(data.sessionId)
              } else if (data.type === 'done') {
                // Stream completed
                assistantMessage.status = 'complete'
                setMessages(prev => {
                  const newMessages = [...prev]
                  const assistantIndex = newMessages.findIndex(m => m.id === assistantMessage.id)
                  if (assistantIndex >= 0) {
                    newMessages[assistantIndex] = { ...assistantMessage }
                  }
                  return newMessages
                })
              } else if (data.type === 'error') {
                assistantMessage.status = 'error'
                addStatusMessage(`❌ Error: ${data.error}`, 'error')
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request aborted')
      } else {
        console.error('Error sending message:', error)
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `Error: ${error.message}`,
          timestamp: new Date()
        }])
      }
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }

  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearHistory = async () => {
    if (!confirm('Are you sure you want to clear the chat history for this context?')) return

    try {
      await fetch(getApiUrl('/api/ai/history'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          contextType,
          contextPath
        })
      })
      setMessages([])
      setSessionId(null)
    } catch (error) {
      console.error('Error clearing history:', error)
    }
  }

  if (hasApiKey === false) {
    return (
      <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">AI Assistant</h3>
          {onClose && (
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-gray-600 mb-4">No API key configured</p>
            <p className="text-sm text-gray-500">Please contact your admin to set up the Claude API key</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden" style={{ maxHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold">AI Assistant</h3>
          <p className="text-xs text-gray-500">
            {contextType === 'folder' ? '📁 Folder' : contextType === 'file' ? '📄 File' : '🌐 Global'}: {contextPath || 'Root'}
          </p>
          {messages.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {messages.length} message{messages.length !== 1 ? 's' : ''} in this context
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Model Switcher */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="text-sm border rounded px-2 py-1"
            title="Select AI Model"
          >
            <option value="claude-sonnet-4">Claude Sonnet 4</option>
            <option value="claude-opus-4-1">Claude Opus 4.1</option>
          </select>
          <button
            onClick={clearHistory}
            className="text-sm text-gray-500 hover:text-gray-700"
            title="Clear history"
          >
            Clear
          </button>
          {onClose && (
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p>Start a conversation about this {contextType}</p>
            <p className="text-sm mt-2">I can help you create, edit, and manage files</p>
          </div>
        )}
        
        {messages.map((message) => {
          // Render status messages differently
          if (message.role === 'status') {
            return (
              <div key={message.id} className="flex justify-center my-2 animate-fadeIn">
                <div className={`inline-flex items-start gap-2 px-4 py-2 rounded-lg text-sm max-w-md ${
                  message.status === 'thinking' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                  message.status === 'processing' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                  message.status === 'complete' ? 'bg-green-50 text-green-700 border border-green-200' :
                  message.status === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                  'bg-gray-50 text-gray-700 border border-gray-200'
                }`}>
                  <span className="flex-shrink-0 mt-0.5">
                    {message.status === 'thinking' && <span className="animate-pulse">🤔</span>}
                    {message.status === 'processing' && <span className="animate-spin inline-block">⚙️</span>}
                    {message.status === 'complete' && <span>✅</span>}
                    {message.status === 'error' && <span>❌</span>}
                  </span>
                  <span className="whitespace-pre-wrap break-words">{message.content}</span>
                </div>
              </div>
            )
          }

          return (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : message.role === 'system'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-900'
                } ${message.status === 'processing' ? 'opacity-70' : ''}`}
              >
                {/* Show processing indicator for assistant messages */}
                {message.role === 'assistant' && message.status === 'processing' && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-gray-600">
                    <span className="animate-pulse">✍️ Writing response...</span>
                  </div>
                )}

                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code: ({ className, children, ...props }: any) => {
                          const match = /language-(\w+)/.exec(className || '')
                          return match ? (
                            <pre className="bg-gray-800 text-gray-100 p-2 rounded overflow-x-auto">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          ) : (
                            <code className="bg-gray-200 px-1 rounded" {...props}>
                              {children}
                            </code>
                          )
                        }
                      }}
                    >
                      {message.content || '...'}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
                
                {/* Enhanced tool display */}
                {message.tools_called && message.tools_called.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <div className="font-semibold text-xs mb-2">🛠️ Tools Executed:</div>
                    {message.tools_called.map((tool, idx) => (
                      <div key={idx} className="ml-2 mb-2 p-2 bg-white bg-opacity-50 rounded text-xs">
                        <div className="flex items-center gap-2">
                          {tool.status === 'pending' && <span className="animate-pulse">⏳</span>}
                          {tool.status === 'running' && <span className="animate-spin">⚙️</span>}
                          {tool.status === 'completed' && <span>✅</span>}
                          {tool.status === 'failed' && <span>❌</span>}
                          <span className="font-medium">{tool.name}</span>
                        </div>
                        {tool.input && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-gray-600">Parameters</summary>
                            <pre className="mt-1 p-1 bg-gray-50 rounded overflow-x-auto text-xs">
                              {JSON.stringify(tool.input, null, 2)}
                            </pre>
                          </details>
                        )}
                        {tool.result && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-gray-600">Result</summary>
                            <pre className="mt-1 p-1 bg-green-50 rounded overflow-x-auto text-xs">
                              {JSON.stringify(tool.result, null, 2)}
                            </pre>
                          </details>
                        )}
                        {tool.error && (
                          <div className="mt-1 p-1 bg-red-50 rounded text-red-600">
                            Error: {tool.error}
                          </div>
                        )}
                        {tool.startTime && tool.endTime && (
                          <div className="mt-1 text-gray-500">
                            Duration: {(tool.endTime.getTime() - tool.startTime.getTime())}ms
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        
        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3 text-gray-500 text-sm">
              <span className="inline-block animate-pulse">AI is thinking...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about this ${contextType}...`}
            className="flex-1 p-2 border rounded-lg resize-none"
            rows={2}
            disabled={isLoading}
          />
          <div className="flex flex-col gap-2">
            {isStreaming ? (
              <button
                onClick={stopStreaming}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  )
}