'use client'

import { FileNode } from '@/lib/types'
import { FileText } from 'lucide-react'

interface FileTreeRendererProps {
  node: FileNode
  level: number
  searchTerm: string
  sortBy: 'name' | 'size' | 'date' | 'type'
  sortOrder: 'asc' | 'desc'
  expandedFolders: Set<string>
  selectedFile?: FileNode | null
  draggedItem: FileNode | null
  dragOverFolder: string | null
  onFileSelect: (file: FileNode) => void
  onToggleFolder: (path: string) => void
  onContextMenu: (e: React.MouseEvent, node?: FileNode, isRoot?: boolean) => void
  onDragStart: (e: React.DragEvent, node: FileNode) => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent, folderPath: string) => void
  onDrop: (e: React.DragEvent, targetFolder?: FileNode) => void
}

export default function FileTreeRenderer({
  node,
  level,
  searchTerm,
  sortBy,
  sortOrder,
  expandedFolders,
  selectedFile,
  draggedItem,
  dragOverFolder,
  onFileSelect,
  onToggleFolder,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop
}: FileTreeRendererProps) {
  const isExpanded = expandedFolders.has(node.path)
  const isSelected = selectedFile?.path === node.path
  const isDragged = draggedItem?.path === node.path
  const isDragOver = dragOverFolder === node.path

  // Filter children based on search term
  const filteredChildren = node.children?.filter(child => 
    !searchTerm || child.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  // Sort children
  const sortedChildren = [...filteredChildren].sort((a, b) => {
    let comparison = 0
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'size':
        comparison = (a.size || 0) - (b.size || 0)
        break
      case 'date':
        comparison = new Date(a.uploadedAt || 0).getTime() - new Date(b.uploadedAt || 0).getTime()
        break
      case 'type':
        comparison = a.type.localeCompare(b.type)
        break
    }
    
    return sortOrder === 'asc' ? comparison : -comparison
  })

  return (
    <div className="select-none">
      <div
        className={`
          flex items-center py-1 px-2 cursor-pointer hover:bg-gray-100
          ${isSelected ? 'bg-blue-100 border-l-4 border-blue-500' : ''}
          ${isDragged ? 'opacity-50' : ''}
          ${isDragOver ? 'bg-green-100 border-l-4 border-green-500' : ''}
        `}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => {
          if (node.type === 'folder') {
            onToggleFolder(node.path)
          } else {
            onFileSelect(node)
          }
        }}
        onContextMenu={(e) => onContextMenu(e, node)}
        draggable
        onDragStart={(e) => onDragStart(e, node)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          e.preventDefault()
          if (node.type === 'folder') {
            onDragOver(e, node.path)
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (node.type === 'folder') {
            onDrop(e, node)
          }
        }}
      >
        <div className="flex items-center gap-2 flex-1">
          {node.type === 'folder' ? (
            <span className="text-sm">
              {isExpanded ? '📂' : '📁'}
            </span>
          ) : (
            <FileText className="w-4 h-4 text-gray-600" />
          )}
          
          <span className="text-sm truncate flex-1">
            {node.name}
          </span>
          
          {node.size && (
            <span className="text-xs text-gray-500">
              {formatFileSize(node.size)}
            </span>
          )}
        </div>
      </div>

      {/* Render children if folder is expanded */}
      {node.type === 'folder' && isExpanded && (
        <div>
          {sortedChildren.map((child, childIndex) => (
            <FileTreeRenderer
              key={child.path}
              node={child}
              level={level + 1}
              searchTerm={searchTerm}
              sortBy={sortBy}
              sortOrder={sortOrder}
              expandedFolders={expandedFolders}
              selectedFile={selectedFile}
              draggedItem={draggedItem}
              dragOverFolder={dragOverFolder}
              onFileSelect={onFileSelect}
              onToggleFolder={onToggleFolder}
              onContextMenu={onContextMenu}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
