'use client'

import { useState, useRef, useEffect } from 'react'
import { getApiUrl } from '@/lib/utils/api'

interface SimpleAIChatProps {
  currentFolder: string
  selectedFile?: {
    name: string
    type: 'file' | 'folder'
    path: string
  } | null
  onClose: () => void
  onFilesChanged: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  tools?: any[]
}

export default function SimpleAIChat({ currentFolder, selectedFile, onClose, onFilesChanged, isCollapsed = false, onToggleCollapse }: SimpleAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch(getApiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage.content,
          currentFolder,
          selectedFile
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get AI response')
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message || 'Done!',
        tools: data.tools
      }

      setMessages(prev => [...prev, assistantMessage])

      // If files were changed, notify parent
      if (data.tools?.some((t: any) => 
        ['create_file', 'edit_file', 'delete_file', 'rename_file'].includes(t.tool)
      )) {
        onFilesChanged()
      }

    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }])
    } finally {
      setLoading(false)
    }
  }

  // Collapsed drawer state
  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-white border-l flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="text-gray-500 hover:text-gray-700 mb-4"
          title="Expand AI Assistant"
        >
          ◀
        </button>
        <div className="writing-mode-vertical text-xs text-gray-500" style={{ writingMode: 'vertical-rl' }}>
          AI Assistant
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Minimal Header - just collapse button */}
      <div className="flex justify-end p-2 border-b">
        <button
          onClick={onToggleCollapse}
          className="text-gray-500 hover:text-gray-700"
          title="Collapse AI Assistant"
        >
          ▶
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-4xl mb-2">🤖</div>
            <p>Hi! I can help you create and manage HTML files.</p>
            <p className="text-sm mt-2">Try: "Create a new contact.html page"</p>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`${
              msg.role === 'user' 
                ? 'bg-blue-50 ml-8' 
                : 'bg-gray-50 mr-8'
            } rounded-lg p-3`}
          >
            <div className="text-sm font-medium mb-1">
              {msg.role === 'user' ? 'You' : 'AI'}
            </div>
            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
            
            {msg.tools && msg.tools.length > 0 && (
              <div className="mt-2 pt-2 border-t text-xs">
                <div className="font-medium mb-1">Actions taken:</div>
                {msg.tools.map((tool, idx) => (
                  <div key={idx} className="text-gray-600">
                    • {tool.tool}: {JSON.stringify(tool.input)}
                    {tool.result?.error && (
                      <span className="text-red-600"> (Error: {tool.result.error})</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="bg-gray-50 rounded-lg p-3 mr-8">
            <div className="text-sm">AI is thinking...</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3">
        {/* Minimal working context indicator */}
        <div className="text-xs text-gray-500 mb-1 px-1">
          {selectedFile 
            ? selectedFile.type === 'file' 
              ? `📄 ${selectedFile.name}`
              : `📁 ${selectedFile.path}`
            : '📁 /'}
        </div>
        
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask me to create or edit HTML files..."
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}