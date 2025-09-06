'use client'

import { useEffect, useState } from 'react'
import FileBrowser from '@/components/FileBrowser'
import FileEditor from '@/components/FileEditor'
import AIChat from '@/components/AIChat'
import { getApiUrl } from '@/lib/utils/api'

interface UserInfo {
  tenant_id: string
  user_id: string
  email: string
  role: string
}

interface FileNode {
  name: string
  type: 'file' | 'folder'
  path: string
  url?: string
  isPublished?: boolean
  publicUrl?: string
}

export default function PageBuilderDashboard() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [showAIChat, setShowAIChat] = useState(false)
  const [aiChatContext, setAIChatContext] = useState<{ type: 'file' | 'folder', path: string } | null>(null)

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch(getApiUrl('/api/auth/me'))
        if (response.ok) {
          const userData = await response.json()
          setUser(userData)
        }
      } catch (error) {
        // Silent fail - user will see auth failed message
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [])

  const handleBackToGateway = () => {
    window.location.href = '/dashboard'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Authentication failed</p>
          <button
            onClick={handleBackToGateway}
            className="px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-yellow-400 hover:bg-yellow-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            Back to Gateway
          </button>
        </div>
      </div>
    )
  }

  const openAIChat = (type: 'file' | 'folder', path: string) => {
    setAIChatContext({ type, path })
    setShowAIChat(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b-2 border-black">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold">Page Builder</h1>
              <p className="text-sm text-gray-600">AI-Powered File System Manager</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => openAIChat('folder', '/')}
                className="px-3 py-1.5 border border-purple-500 text-sm font-medium rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700"
              >
                🤖 AI Assistant
              </button>
              <div className="text-right">
                <div className="text-sm text-gray-600">{user.email}</div>
                {user.tenant_id && (
                  <div className="text-xs text-gray-500">Tenant: {user.tenant_id.slice(0, 8)}...</div>
                )}
              </div>
              <button
                onClick={handleBackToGateway}
                className="px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-white hover:bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                Back to Gateway
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - File System */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Browser */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="font-semibold text-gray-900">Files</h2>
            <p className="text-xs text-gray-500 mt-1">Your tenant workspace</p>
          </div>
          <FileBrowser 
            onFileSelect={setSelectedFile}
            selectedFile={selectedFile}
            onOpenAIChat={openAIChat}
          />
        </div>

        {/* Middle - File Editor */}
        <div className="flex-1">
          <FileEditor 
            file={selectedFile} 
            onOpenAIChat={openAIChat}
          />
        </div>

        {/* Right Sidebar - AI Chat (when open) */}
        {showAIChat && aiChatContext && (
          <div className="w-96 border-l border-gray-200">
            <AIChat
              contextType={aiChatContext.type}
              contextPath={aiChatContext.path}
              tenantId={user.tenant_id}
              onClose={() => setShowAIChat(false)}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="bg-gray-800 text-white text-xs px-4 py-2 flex justify-between">
        <div className="flex items-center gap-4">
          <span>🟢 Connected to NUM Gate</span>
          <span>|</span>
          <span>Blob Storage: Active</span>
        </div>
        <div>
          {selectedFile ? `Editing: ${selectedFile.path}` : 'No file selected'}
        </div>
      </div>
    </div>
  )
}