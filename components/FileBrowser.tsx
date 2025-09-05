'use client'

import { useState, useEffect } from 'react'

interface FileNode {
  name: string
  type: 'file' | 'folder'
  path: string
  url?: string
  size?: number
  uploadedAt?: string
  children?: FileNode[]
}

interface FileBrowserProps {
  onFileSelect: (file: FileNode) => void
  selectedFile?: FileNode | null
}

export default function FileBrowser({ onFileSelect, selectedFile }: FileBrowserProps) {
  const [files, setFiles] = useState<FileNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']))

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/files/list')
      
      if (!response.ok) {
        throw new Error('Failed to load files')
      }
      
      const data = await response.json()
      setFiles(data.files)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedFolders(newExpanded)
  }

  const renderNode = (node: FileNode, level: number = 0) => {
    const isFolder = node.type === 'folder'
    const isExpanded = expandedFolders.has(node.path)
    const isSelected = selectedFile?.path === node.path

    return (
      <div key={node.path || node.name}>
        <div
          className={`
            flex items-center gap-2 px-2 py-1.5 cursor-pointer
            hover:bg-gray-100 transition-colors
            ${isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : ''}
          `}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => {
            if (isFolder) {
              toggleFolder(node.path)
            } else {
              onFileSelect(node)
            }
          }}
        >
          {/* Icon */}
          <span className="text-gray-600">
            {isFolder ? (
              isExpanded ? '📂' : '📁'
            ) : (
              node.name.endsWith('.html') ? '📄' :
              node.name.endsWith('.css') ? '🎨' :
              node.name.endsWith('.js') ? '⚡' : '📎'
            )}
          </span>
          
          {/* Name */}
          <span className={`flex-1 text-sm ${isSelected ? 'font-semibold' : ''}`}>
            {node.name}
          </span>
          
          {/* File size */}
          {!isFolder && node.size && (
            <span className="text-xs text-gray-500">
              {(node.size / 1024).toFixed(1)}KB
            </span>
          )}
        </div>

        {/* Render children if folder is expanded */}
        {isFolder && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading files...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-600 text-sm">{error}</div>
        <button 
          onClick={loadFiles}
          className="mt-2 text-blue-600 text-sm hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!files || (files.children && files.children.length === 0)) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="mb-2">📭</div>
        <div className="text-sm">No files found</div>
        <div className="text-xs mt-1">Upload your first page to get started</div>
      </div>
    )
  }

  return (
    <div className="py-2">
      {files.children?.map(node => renderNode(node))}
    </div>
  )
}