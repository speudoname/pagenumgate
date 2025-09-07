'use client'

import { useState, useEffect } from 'react'
import { getApiUrl } from '@/lib/utils/api'
import { FileNode } from '@/lib/types'

interface MoveModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (targetPath: string) => void
  itemName: string
  currentPath: string
}

export default function MoveModal({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  currentPath
}: MoveModalProps) {
  const [files, setFiles] = useState<FileNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPath, setSelectedPath] = useState<string>('/')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']))

  useEffect(() => {
    if (isOpen) {
      loadFiles()
    }
  }, [isOpen])

  const loadFiles = async () => {
    try {
      setLoading(true)
      const response = await fetch(getApiUrl('/api/files/list'))
      
      if (!response.ok) {
        throw new Error('Failed to load files')
      }
      
      const data = await response.json()
      setFiles(data.files)
    } catch (err) {
      console.error('Failed to load files:', err)
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

  const canMoveToFolder = (folderPath: string) => {
    // Can't move to itself or its children
    if (currentPath === folderPath || folderPath.startsWith(currentPath + '/')) {
      return false
    }
    return true
  }

  const renderFolder = (node: FileNode, level: number = 0): React.ReactNode => {
    if (node.type !== 'folder') return null
    
    const isExpanded = expandedFolders.has(node.path)
    const isSelected = selectedPath === node.path
    const canMove = canMoveToFolder(node.path)

    return (
      <div key={node.path}>
        <div
          className={`
            flex items-center gap-2 px-2 py-1.5 cursor-pointer
            hover:bg-gray-100 transition-colors
            ${isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : ''}
            ${!canMove ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => {
            if (canMove) {
              toggleFolder(node.path)
              setSelectedPath(node.path)
            }
          }}
        >
          <span className="text-gray-600">
            {isExpanded ? '📂' : '📁'}
          </span>
          <span className="flex-1 text-sm">
            {node.name || '/'}
          </span>
          {!canMove && (
            <span className="text-xs text-red-500">Cannot move here</span>
          )}
        </div>

        {isExpanded && node.children && (
          <div>
            {node.children
              .filter(child => child.type === 'folder')
              .map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white border-2 border-black rounded-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
        <h2 className="text-xl font-bold mb-4">Move "{itemName}"</h2>
        
        <p className="text-gray-600 mb-4">Select a destination folder:</p>

        <div className="border-2 border-gray-200 rounded p-2 mb-4 flex-1 overflow-y-auto min-h-[200px]">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              Loading folders...
            </div>
          ) : (
            <div>
              {/* Root folder */}
              <div
                className={`
                  flex items-center gap-2 px-2 py-1.5 cursor-pointer
                  hover:bg-gray-100 transition-colors
                  ${selectedPath === '/' ? 'bg-blue-50 border-l-2 border-blue-500' : ''}
                  ${!canMoveToFolder('/') ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                onClick={() => {
                  if (canMoveToFolder('/')) {
                    setSelectedPath('/')
                  }
                }}
              >
                <span className="text-gray-600">📂</span>
                <span className="flex-1 text-sm">/ (Root)</span>
                {!canMoveToFolder('/') && (
                  <span className="text-xs text-red-500">Cannot move here</span>
                )}
              </div>
              
              {/* Subfolders */}
              {files?.children
                ?.filter(child => child.type === 'folder')
                .map(child => renderFolder(child, 1))}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border-2 border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedPath)}
            className="px-4 py-2 border-2 border-black rounded font-medium bg-blue-500 text-white hover:bg-blue-600"
            disabled={!canMoveToFolder(selectedPath)}
          >
            Move Here
          </button>
        </div>
      </div>
    </div>
  )
}