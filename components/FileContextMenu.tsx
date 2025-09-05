'use client'

import { useEffect, useRef } from 'react'

interface FileContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onNewFile: () => void
  onNewFolder: () => void
  onRename?: () => void
  onDelete?: () => void
  onDuplicate?: () => void
  onPublish?: () => void
  onUnpublish?: () => void
  onCopyUrl?: () => void
  isRoot?: boolean
  itemType?: 'file' | 'folder'
  isPublished?: boolean
  fileName?: string
}

export default function FileContextMenu({
  x,
  y,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onDuplicate,
  onPublish,
  onUnpublish,
  onCopyUrl,
  isRoot = false,
  itemType,
  isPublished = false,
  fileName
}: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="fixed bg-white border-2 border-black rounded-md shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 py-1 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {/* Create operations - always available */}
      <button
        onClick={() => {
          onNewFile()
          onClose()
        }}
        className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 text-sm"
      >
        <span>📄</span>
        <span>New File</span>
      </button>
      
      <button
        onClick={() => {
          onNewFolder()
          onClose()
        }}
        className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 text-sm"
      >
        <span>📁</span>
        <span>New Folder</span>
      </button>

      {/* Separator */}
      {!isRoot && <div className="border-t border-gray-200 my-1" />}

      {/* Item-specific operations */}
      {!isRoot && onRename && (
        <button
          onClick={() => {
            onRename()
            onClose()
          }}
          className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 text-sm"
        >
          <span>✏️</span>
          <span>Rename</span>
        </button>
      )}

      {!isRoot && onDuplicate && itemType === 'file' && (
        <button
          onClick={() => {
            onDuplicate()
            onClose()
          }}
          className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 text-sm"
        >
          <span>📋</span>
          <span>Duplicate</span>
        </button>
      )}

      {/* Publishing options - only for HTML files */}
      {!isRoot && fileName?.endsWith('.html') && (
        <>
          <div className="border-t border-gray-200 my-1" />
          
          {!isPublished && onPublish && (
            <button
              onClick={() => {
                onPublish()
                onClose()
              }}
              className="w-full px-3 py-2 text-left hover:bg-green-50 text-green-700 flex items-center gap-2 text-sm"
            >
              <span>🌐</span>
              <span>Publish</span>
            </button>
          )}

          {isPublished && onUnpublish && (
            <button
              onClick={() => {
                onUnpublish()
                onClose()
              }}
              className="w-full px-3 py-2 text-left hover:bg-orange-50 text-orange-700 flex items-center gap-2 text-sm"
            >
              <span>🌐</span>
              <span>Unpublish</span>
            </button>
          )}

          {isPublished && onCopyUrl && (
            <button
              onClick={() => {
                onCopyUrl()
                onClose()
              }}
              className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 text-sm"
            >
              <span>📋</span>
              <span>Copy Public URL</span>
            </button>
          )}
        </>
      )}

      {!isRoot && onDelete && (
        <>
          <div className="border-t border-gray-200 my-1" />
          <button
            onClick={() => {
              onDelete()
              onClose()
            }}
            className="w-full px-3 py-2 text-left hover:bg-red-50 text-red-600 flex items-center gap-2 text-sm"
          >
            <span>🗑️</span>
            <span>Delete</span>
          </button>
        </>
      )}
    </div>
  )
}