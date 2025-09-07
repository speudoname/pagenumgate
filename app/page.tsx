'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import FileBrowser, { FileBrowserRef } from '@/components/FileBrowser'
import FileEditor from '@/components/FileEditor'
import SimpleAIChat from '@/components/SimpleAIChat'
import { getApiUrl } from '@/lib/utils/api'
import { UserInfo, FileNode } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronLeft, Circle } from 'lucide-react'

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

  const handleToggleFullScreen = useCallback(() => {
    // Toggle both sidebars at once
    if (!fileBrowserCollapsed || !aiChatCollapsed) {
      // If either sidebar is open, collapse both
      setFileBrowserCollapsed(true)
      setAiChatCollapsed(true)
    } else {
      // If both are collapsed, expand both
      setFileBrowserCollapsed(false)
      setAiChatCollapsed(false)
    }
  }, [fileBrowserCollapsed, aiChatCollapsed])

  // Auto-select root directory on page load
  useEffect(() => {
    if (user && !selectedFile) {
      // Create a root directory node
      const rootNode: FileNode = {
        name: '/',
        type: 'folder',
        path: '/',
        children: []
      }
      setSelectedFile(rootNode)
    }
  }, [user, selectedFile])

  const handleMouseDown = (side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(side)
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    
    e.preventDefault()
    
    if (isResizing === 'left') {
      const newWidth = Math.max(200, Math.min(600, e.clientX))
      setLeftSidebarWidth(newWidth)
    } else if (isResizing === 'right') {
      const newWidth = Math.max(200, Math.min(600, window.innerWidth - e.clientX))
      setRightSidebarWidth(newWidth)
    }
  }, [isResizing])

  const handleMouseUp = useCallback((e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(null)
  }, [])

  // Mouse event listeners for resize - MUST be before any early returns
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove, { passive: false })
      document.addEventListener('mouseup', handleMouseUp, { passive: false })
      document.addEventListener('mouseleave', handleMouseUp, { passive: false })
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('mouseleave', handleMouseUp)
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
              <Button
                variant="warning"
                size="sm"
                onClick={handleBackToGateway}
              >
                Back to Gateway
              </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Thin Header */}
      <div className="bg-black text-white border-b border-gray-300 px-4 py-1 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div className="text-xs text-white">
            {selectedFile ? `Editing: ${selectedFile.path}` : 'No file selected'}
          </div>
          <div className="text-xs text-gray-300">
            {user.email}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar - File Browser with collapse */}
        {fileBrowserCollapsed ? (
          <div className="w-12 h-full bg-white border-r-2 border-black flex flex-col items-center py-4">
            <button
              onClick={() => setFileBrowserCollapsed(false)}
              className="w-8 h-8 bg-gray-100 border-2 border-black rounded-md flex items-center justify-center text-gray-700 hover:bg-gray-200 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-100 mb-4"
              title="Expand File Browser"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="writing-mode-vertical text-xs text-gray-500" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              Files
            </div>
          </div>
        ) : (
          <div className="bg-white border-r-2 border-black flex flex-col overflow-hidden" style={{ width: leftSidebarWidth }}>
            <div className="border-b-2 border-black px-4 py-3 flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-gray-900">Files</h2>
                <p className="text-xs text-gray-500 mt-1">Your workspace</p>
              </div>
              <button
                onClick={() => setFileBrowserCollapsed(true)}
                className="w-8 h-8 bg-gray-100 border-2 border-black rounded-md flex items-center justify-center text-gray-700 hover:bg-gray-200 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all duration-100"
                title="Collapse File Browser"
              >
                <ChevronLeft className="w-4 h-4" />
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
            className="w-1 bg-black hover:bg-gray-800 cursor-col-resize transition-colors"
            onMouseDown={handleMouseDown('left')}
          />
        )}

        {/* Middle - File Editor */}
        <div className="flex-1 min-h-0 flex flex-col border-l-2 border-r-2 border-black">
          <FileEditor 
            file={selectedFile}
            onToggleFullScreen={handleToggleFullScreen}
          />
        </div>

        {/* Right Resize Handle */}
        {!aiChatCollapsed && (
          <div
            className="w-1 bg-black hover:bg-gray-800 cursor-col-resize transition-colors"
            onMouseDown={handleMouseDown('right')}
          />
        )}

        {/* Right Sidebar - AI Assistant (always visible, can collapse) */}
        <div className={`${aiChatCollapsed ? 'w-12' : ''} h-full border-l-2 border-black transition-all duration-300`} style={!aiChatCollapsed ? { width: rightSidebarWidth } : {}}>
          <SimpleAIChat
            currentFolder={selectedFile ? (selectedFile.type === 'folder' ? selectedFile.path : selectedFile.path.substring(0, selectedFile.path.lastIndexOf('/')) || '/') : '/'}
            selectedFile={selectedFile}
            onClose={() => {}}
            onFilesChanged={handleFilesChanged}
            isCollapsed={aiChatCollapsed}
            onToggleCollapse={() => setAiChatCollapsed(!aiChatCollapsed)}
            onBackToGateway={handleBackToGateway}
          />
        </div>
      </div>

      {/* Thin Footer */}
      <div className="bg-gray-800 text-white text-xs px-4 py-1 flex justify-between flex-shrink-0 border-t border-gray-600">
        <div className="flex items-center gap-4">
          <span><Circle className="w-3 h-3 text-green-500 fill-current" /> Connected to NUM Gate</span>
          <span>|</span>
          <span>Blob Storage: Active</span>
        </div>
        <div>
          Powered by NumGate
        </div>
      </div>
    </div>
  )
}