'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import FileBrowser, { FileBrowserRef } from '@/components/FileBrowser'
import FileEditor from '@/components/FileEditor'
import SimpleAIChat from '@/components/SimpleAIChat'
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
  const [aiChatCollapsed, setAiChatCollapsed] = useState(false)
  const [fileBrowserCollapsed, setFileBrowserCollapsed] = useState(false)
  const [currentFolder, setCurrentFolder] = useState<string>('/')
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(320)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(384)
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null)
  const fileBrowserRef = useRef<FileBrowserRef>(null)

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

  // Track current folder from selected file
  useEffect(() => {
    if (selectedFile) {
      if (selectedFile.type === 'folder') {
        setCurrentFolder(selectedFile.path)
      } else {
        // Extract folder from file path
        const folderPath = selectedFile.path.substring(0, selectedFile.path.lastIndexOf('/')) || '/'
        setCurrentFolder(folderPath)
      }
    }
  }, [selectedFile])

  const handleBackToGateway = () => {
    window.location.href = '/dashboard'
  }

  const handleFilesChanged = async () => {
    // Refresh the file browser when AI makes changes
    if (fileBrowserRef.current) {
      await fileBrowserRef.current.refreshFiles()
    }
  }

  const handleMouseDown = (side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(side)
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    
    if (isResizing === 'left') {
      const newWidth = Math.max(200, Math.min(600, e.clientX))
      setLeftSidebarWidth(newWidth)
    } else if (isResizing === 'right') {
      const newWidth = Math.max(200, Math.min(600, window.innerWidth - e.clientX))
      setRightSidebarWidth(newWidth)
    }
  }, [isResizing])

  const handleMouseUp = useCallback(() => {
    setIsResizing(null)
  }, [])

  // Mouse event listeners for resize - MUST be before any early returns
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  // Early returns AFTER all hooks
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

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-2">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold">AI Page Builder</h1>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs text-gray-600">Build static pages with AI assistance</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-gray-600">{user.email}</div>
              </div>
              <button
                onClick={handleBackToGateway}
                className="px-3 py-1.5 border border-gray-300 text-xs font-medium rounded hover:bg-gray-50 transition-colors"
              >
                Back to Gateway
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - File System */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar - File Browser with collapse */}
        {fileBrowserCollapsed ? (
          <div className="w-12 h-full bg-white border-r flex flex-col items-center py-4">
            <button
              onClick={() => setFileBrowserCollapsed(false)}
              className="text-gray-500 hover:text-gray-700 mb-4"
              title="Expand File Browser"
            >
              ▶
            </button>
            <div className="writing-mode-vertical text-xs text-gray-500" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              Files
            </div>
          </div>
        ) : (
          <div className="bg-white border-r border-gray-200 flex flex-col overflow-hidden" style={{ width: leftSidebarWidth }}>
            <div className="border-b border-gray-200 px-4 py-3 flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-gray-900">Files</h2>
                <p className="text-xs text-gray-500 mt-1">Your workspace</p>
              </div>
              <button
                onClick={() => setFileBrowserCollapsed(true)}
                className="text-gray-500 hover:text-gray-700"
                title="Collapse File Browser"
              >
                ◀
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <FileBrowser 
                ref={fileBrowserRef}
                onFileSelect={setSelectedFile}
                selectedFile={selectedFile}
              />
            </div>
          </div>
        )}

        {/* Left Resize Handle */}
        {!fileBrowserCollapsed && (
          <div
            className="w-1 bg-gray-200 hover:bg-gray-400 cursor-col-resize transition-colors"
            onMouseDown={handleMouseDown('left')}
          />
        )}

        {/* Middle - File Editor */}
        <div className="flex-1 min-h-0 flex flex-col">
          <FileEditor 
            file={selectedFile}
          />
        </div>

        {/* Right Resize Handle */}
        {!aiChatCollapsed && (
          <div
            className="w-1 bg-gray-200 hover:bg-gray-400 cursor-col-resize transition-colors"
            onMouseDown={handleMouseDown('right')}
          />
        )}

        {/* Right Sidebar - AI Assistant (always visible, can collapse) */}
        <div className={`${aiChatCollapsed ? 'w-12' : ''} h-full border-l border-gray-200 transition-all duration-300`} style={!aiChatCollapsed ? { width: rightSidebarWidth } : {}}>
          <SimpleAIChat
            currentFolder={selectedFile ? (selectedFile.type === 'folder' ? selectedFile.path : selectedFile.path.substring(0, selectedFile.path.lastIndexOf('/')) || '/') : '/'}
            selectedFile={selectedFile}
            onClose={() => {}}
            onFilesChanged={handleFilesChanged}
            isCollapsed={aiChatCollapsed}
            onToggleCollapse={() => setAiChatCollapsed(!aiChatCollapsed)}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-gray-800 text-white text-xs px-4 py-2 flex justify-between flex-shrink-0">
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