'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface AIChatProps {
  contextType: 'file' | 'folder' | 'global'
  contextPath: string
  tenantId: string
  onClose?: () => void
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  tools_called?: any[]
  timestamp: Date
}

interface ChatSession {
  id: string
  messages: Message[]
}

export default function AIChat({ contextType, contextPath, tenantId, onClose }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('claude-3-5-sonnet-latest')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

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
      const response = await fetch('/api/ai/check-key')
      const data = await response.json()
      setHasApiKey(data.hasKey)
    } catch (error) {
      console.error('Error checking API key:', error)
      setHasApiKey(false)
    }
  }

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/ai/history?contextType=${contextType}&contextPath=${encodeURIComponent(contextPath)}`)
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

    try {
      abortControllerRef.current = new AbortController()
      
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          contextType,
          contextPath,
          message: userMessage.content,
          history: messages,
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

      // Handle streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date()
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
                setMessages(prev => {
                  const newMessages = [...prev]
                  newMessages[newMessages.length - 1] = { ...assistantMessage }
                  return newMessages
                })
              } else if (data.type === 'tool_use') {
                if (!assistantMessage.tools_called) {
                  assistantMessage.tools_called = []
                }
                assistantMessage.tools_called.push(data.tool)
              } else if (data.type === 'session') {
                setSessionId(data.sessionId)
              } else if (data.type === 'done') {
                // Stream completed
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
      await fetch('/api/ai/history', {
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
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold">AI Assistant</h3>
          <p className="text-xs text-gray-500">
            {contextType === 'folder' ? '📁' : '📄'} {contextPath || 'Global'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Model Switcher */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="text-sm border rounded px-2 py-1"
            title="Select AI Model"
          >
            <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet (Fast)</option>
            <option value="claude-3-opus-latest">Claude 3 Opus (Powerful)</option>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p>Start a conversation about this {contextType}</p>
            <p className="text-sm mt-2">I can help you create, edit, and manage files</p>
          </div>
        )}
        
        {messages.map((message) => (
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
              }`}
            >
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
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{message.content}</div>
              )}
              
              {message.tools_called && message.tools_called.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-300 text-xs">
                  <div className="font-semibold mb-1">Tools used:</div>
                  {message.tools_called.map((tool, idx) => (
                    <div key={idx} className="ml-2">
                      • {tool.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
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