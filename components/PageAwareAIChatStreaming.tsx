'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from 'ai/react'
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

export default function PageAwareAIChatStreaming({ 
  currentFolder, 
  selectedFile, 
  onClose, 
  onFilesChanged, 
  isCollapsed = false, 
  onToggleCollapse, 
  onBackToGateway,
  getCurrentPageHTML
}: PageAwareAIChatProps) {
  const [historyLoading, setHistoryLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Get the current page ID (use file path as ID)
  const pageId = selectedFile?.type === 'file' 
    ? selectedFile.path 
    : currentFolder || 'root'

  // Create page context
  const getPageContext = () => ({
    pageId,
    currentHTML: getCurrentPageHTML ? getCurrentPageHTML() : '',
    selectedElement: null, // TODO: Add element selection
    folderPath: currentFolder
  })

  // Use Vercel AI SDK's useChat hook for streaming
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: getApiUrl('/api/ai/stream-v2'),
    body: {
      pageContext: getPageContext(),
    },
    onFinish: () => {
      // Notify if files changed
      onFilesChanged()
    },
    onError: (error) => {
      console.error('Chat error:', error)
    }
  })

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
            setMessages(data.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              createdAt: new Date(msg.timestamp)
            })))
          }
        }
      } catch (error) {
        console.error('Failed to load history:', error)
      } finally {
        setHistoryLoading(false)
      }
    }
    
    loadHistory()
  }, [pageId, setMessages])

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

  // Custom submit handler to save user message
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    // Save user message before sending
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    }
    
    try {
      await fetch(getApiUrl('/api/ai/history'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pageId,
          message: userMessage
        })
      })
    } catch (error) {
      console.error('Failed to save message:', error)
    }
    
    // Let useChat handle the actual submission
    handleSubmit(e)
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

        {isLoading && (
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
        <form onSubmit={onSubmit}>
          <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white">
            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onSubmit(e as any)
                }
              }}
              placeholder="Describe what you want to change..."
              rows={3}
              className="w-full px-2 py-2 focus:outline-none resize-none min-h-[80px] max-h-[120px] bg-transparent"
              style={{ overflowY: 'auto' }}
              disabled={isLoading}
            />
            
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="text-xs text-gray-600">
                {getCurrentPageHTML 
                  ? '👁️ AI can see your page (Streaming)' 
                  : '📁 Working on: ' + (selectedFile?.name || '/')}
              </div>
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={isLoading || !input.trim()}
                className="w-6 h-6 p-0"
              >
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}