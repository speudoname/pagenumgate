'use client'

import { useState, useRef, useEffect } from 'react'
import { getApiUrl } from '@/lib/utils/api'
import { FileNode, Message } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Send, FileText, Folder } from 'lucide-react'

interface SimpleAIChatProps {
  currentFolder: string
  selectedFile?: FileNode | null
  onClose: () => void
  onFilesChanged: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  onBackToGateway?: () => void
}

export default function SimpleAIChat({ currentFolder, selectedFile, onClose, onFilesChanged, isCollapsed = false, onToggleCollapse, onBackToGateway }: SimpleAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Scroll to bottom on initial load
  useEffect(() => {
    setTimeout(scrollToBottom, 100)
  }, [])

  // Load or create global chat session
  useEffect(() => {
    async function initSession() {
      try {
        setSessionLoading(true)
        const response = await fetch(getApiUrl('/api/ai/sessions'), {
          method: 'GET',
          credentials: 'include'
        })
        
        if (response.ok) {
          const data = await response.json()
          setSessionId(data.session.id)
          
          // Load existing messages
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              tools: msg.tools_used
            })))
          }
        }
      } catch (error) {
        console.error('Failed to load session:', error)
      } finally {
        setSessionLoading(false)
      }
    }
    
    initSession()
  }, [])  // Only load once on mount

  // Save message to session
  const saveMessageToSession = async (message: Message) => {
    if (!sessionId) return
    
    try {
      await fetch(getApiUrl('/api/ai/sessions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId,
          role: message.role,
          content: message.content,
          tools: message.tools
        })
      })
    } catch (error) {
      console.error('Failed to save message:', error)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || sessionLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    
    // Save user message
    await saveMessageToSession(userMessage)

    try {
      const response = await fetch(getApiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage.content,
          currentFolder,
          selectedFile,
          sessionId,
          conversationHistory: messages
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
      
      // Save assistant message
      await saveMessageToSession(assistantMessage)

      // If files were changed, notify parent
      if (data.tools?.some((t: any) => 
        ['create_file', 'edit_file', 'delete_file', 'rename_file'].includes(t.tool)
      )) {
        onFilesChanged()
      }

    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${errorMessage}. Please check the console for details.`
      }])
    } finally {
      setLoading(false)
    }
  }

  // Collapsed drawer state
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
      {/* Header with Collapse button and Back to Gateway button */}
      <div className="flex justify-between items-center p-3 border-b-2 border-black">
        <button
          onClick={onToggleCollapse}
          className="w-8 h-8 bg-gray-100 border-2 border-black rounded-md flex items-center justify-center text-gray-700 hover:bg-gray-200 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-100"
          title="Collapse AI Assistant"
        >
            <ChevronRight className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
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
        {sessionLoading ? (
          <div className="text-center text-gray-500 mt-8">
            <p>Loading chat history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-4xl mb-2">🤖</div>
            <p>Hi! I can help you create and manage HTML files.</p>
            <p className="text-sm mt-2">Try: "Create a new contact.html page"</p>
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

      {/* Input area with controls inside */}
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
            placeholder="Ask me to create or edit..."
            rows={3}
            className="w-full px-2 py-2 focus:outline-none resize-none min-h-[80px] max-h-[120px] bg-transparent"
            style={{ overflowY: 'auto' }}
            disabled={loading || sessionLoading}
          />
          
          {/* Controls inside the input box */}
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="text-xs text-gray-600">
              {selectedFile 
                ? selectedFile.type === 'file' 
                  ? <>Working on: {selectedFile.name}</>
                  : <>Working on: {selectedFile.path}</>
                : <>Working on: /</>}
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={sendMessage}
              disabled={loading || sessionLoading || !input.trim()}
              className="w-6 h-6 p-0 bg-black hover:bg-gray-800 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-100"
            >
              <Send className="w-3 h-3 text-white" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}