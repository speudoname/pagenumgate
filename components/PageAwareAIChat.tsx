'use client'

import { useState, useRef, useEffect } from 'react'
import { getApiUrl } from '@/lib/utils/api'
import { FileNode } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Send, Loader2, Trash2 } from 'lucide-react'

interface PageAwareAIChatProps {
  currentFolder: string
  selectedFile?: FileNode | null
  onClose: () => void
  onFilesChanged: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  onBackToGateway?: () => void
  getCurrentPageHTML?: () => string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
  tools?: any[]
}

export default function PageAwareAIChat({ 
  currentFolder, 
  selectedFile, 
  onClose, 
  onFilesChanged, 
  isCollapsed = false, 
  onToggleCollapse, 
  onBackToGateway,
  getCurrentPageHTML
}: PageAwareAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Get the current page ID (use file path as ID)
  const pageId = selectedFile?.type === 'file' 
    ? selectedFile.path 
    : currentFolder || 'root'

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load chat history for current page
  useEffect(() => {
    async function loadHistory() {
      try {
        setHistoryLoading(true)
        const response = await fetch(getApiUrl(`/api/ai/history?pageId=${encodeURIComponent(pageId)}`), {
          method: 'GET',
          credentials: 'include'
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages)
          }
        }
      } catch (error) {
        console.error('Failed to load history:', error)
      } finally {
        setHistoryLoading(false)
      }
    }
    
    loadHistory()
  }, [pageId]) // Reload when page changes

  // Save user message
  const saveMessage = async (message: Message) => {
    try {
      await fetch(getApiUrl('/api/ai/history'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pageId,
          message
        })
      })
    } catch (error) {
      console.error('Failed to save message:', error)
    }
  }

  // Clear chat history
  const clearHistory = async () => {
    if (!confirm('Clear chat history for this page?')) return
    
    try {
      await fetch(getApiUrl(`/api/ai/history?pageId=${encodeURIComponent(pageId)}`), {
        method: 'DELETE',
        credentials: 'include'
      })
      setMessages([])
    } catch (error) {
      console.error('Failed to clear history:', error)
    }
  }

  // Send message with streaming
  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    await saveMessage(userMessage)
    setInput('')
    setLoading(true)

    try {
      // Get current page HTML if available
      const currentHTML = getCurrentPageHTML ? getCurrentPageHTML() : ''
      
      // Create page context
      const pageContext = {
        pageId,
        currentHTML,
        selectedElement: null, // TODO: Add element selection
        folderPath: currentFolder
      }

      const response = await fetch(getApiUrl('/api/ai/stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage.content,
          pageContext,
          conversationHistory: messages
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get AI response')
      }

      const data = await response.json()
      
      // Create assistant message
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message || 'Done!',
        timestamp: new Date(),
        tools: data.tools
      }

      setMessages(prev => [...prev, assistantMessage])
      await saveMessage(assistantMessage)
      
      // Notify if files changed
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
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }])
    } finally {
      setLoading(false)
    }
  }

  // Collapsed state
  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-white border-l-2 border-black flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="w-8 h-8 bg-gray-100 border-2 border-black rounded-md flex items-center justify-center text-gray-700 hover:bg-gray-200 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-100 mb-4"
          title="Expand AI Assistant"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="writing-mode-vertical text-xs text-gray-500" style={{ writingMode: 'vertical-rl' }}>
          AI Assistant
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white relative border-l-2 border-black">
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b-2 border-black">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleCollapse}
            className="w-8 h-8 bg-gray-100 border-2 border-black rounded-md flex items-center justify-center text-gray-700 hover:bg-gray-200 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-100"
            title="Collapse"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium">
            {selectedFile?.name || 'Root'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearHistory}
            className="w-8 h-8 bg-gray-100 border-2 border-black rounded-md flex items-center justify-center text-gray-700 hover:bg-gray-200 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-100"
            title="Clear History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {onBackToGateway && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToGateway}
            >
              Back to Gateway
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {historyLoading ? (
          <div className="text-center text-gray-500 mt-8">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p>Loading chat history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-4xl mb-2">🤖</div>
            <p>Hi! I can see and edit your page.</p>
            <p className="text-sm mt-2">
              {getCurrentPageHTML ? 'I can see the current page content.' : 'Select a file to start editing.'}
            </p>
          </div>
        ) : null}

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
          </div>
        ))}

        {loading && (
          <div className="bg-gray-50 rounded-lg p-3 mr-8">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">AI is thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white p-2">
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Describe what you want to change..."
            rows={3}
            className="w-full px-2 py-2 focus:outline-none resize-none min-h-[80px] max-h-[120px] bg-transparent"
            style={{ overflowY: 'auto' }}
            disabled={loading}
          />
          
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="text-xs text-gray-600">
              {getCurrentPageHTML 
                ? '👁️ AI can see your page' 
                : '📁 Working on: ' + (selectedFile?.name || '/')}
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="w-6 h-6 p-0"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}