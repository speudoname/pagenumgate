'use client'

import { useState, useEffect } from 'react'
import { getApiUrl } from '@/lib/utils/api'
import FileContextMenu from './FileContextMenu'
import FileModal from './FileModal'

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

type SortBy = 'name' | 'size' | 'date' | 'type'
type SortOrder = 'asc' | 'desc'

export default function FileBrowser({ onFileSelect, selectedFile }: FileBrowserProps) {
  const [files, setFiles] = useState<FileNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']))
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    node?: FileNode
    isRoot?: boolean
  } | null>(null)
  
  // Modal state
  const [modal, setModal] = useState<{
    type: 'newFile' | 'newFolder' | 'rename' | 'delete' | 'fileType' | null
    node?: FileNode
  }>({ type: null })

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    try {
      setLoading(true)
      const response = await fetch(getApiUrl('/api/files/list'))
      
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


  const handleContextMenu = (e: React.MouseEvent, node?: FileNode, isRoot?: boolean) => {
    e.preventDefault()
    console.log('Context menu opened:', { node: node?.name, isRoot, hasNode: !!node })
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node,
      isRoot
    })
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

  const handleNewFile = async (parentPath: string, fileName: string, fileType: string) => {
    try {
      // Generate template content based on file type
      let content = ''
      let extension = '.html'
      
      switch (fileType) {
        case 'html':
          extension = '.html'
          content = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileName}</title>
</head>
<body>
    <h1>Welcome to ${fileName}</h1>
</body>
</html>`
          break
        case 'css':
          extension = '.css'
          content = `/* ${fileName} styles */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
  padding: 0;
}`
          break
        case 'js':
          extension = '.js'
          content = `// ${fileName} JavaScript
console.log('Hello from ${fileName}!');`
          break
      }
      
      const fullPath = parentPath ? `${parentPath}/${fileName}${extension}` : `${fileName}${extension}`
      
      const response = await fetch(getApiUrl('/api/files/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: fullPath,
          content,
          contentType: fileType === 'css' ? 'text/css' : fileType === 'js' ? 'application/javascript' : 'text/html'
        })
      })
      
      if (response.ok) {
        await loadFiles()
      }
    } catch (error) {
      console.error('Failed to create file:', error)
    }
  }

  const handleNewFolder = async (parentPath: string, folderName: string) => {
    try {
      // Create an index.html file in the folder (Vercel Blob requires files, not empty folders)
      const fullPath = parentPath 
        ? `${parentPath}/${folderName}/index.html` 
        : `${folderName}/index.html`
      
      // Also create an unpublished subfolder with a placeholder file
      const unpublishedPath = parentPath
        ? `${parentPath}/${folderName}/unpublished/draft.html`
        : `${folderName}/unpublished/draft.html`
      
      // Create a basic HTML template for the folder's index page
      const indexContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${folderName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #f5f5f5;
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
        }
        .folder-info {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-top: 20px;
        }
        .path {
            color: #666;
            font-size: 14px;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <h1>${folderName}</h1>
    <div class="folder-info">
        <p>Welcome to the ${folderName} folder.</p>
        <p>This is the default index page. You can edit this file or add more content to this folder.</p>
        <p class="path">Path: ${parentPath ? `${parentPath}/${folderName}` : folderName}/</p>
    </div>
</body>
</html>`

      // Draft template for unpublished folder
      const draftContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Draft - Unpublished</title>
</head>
<body>
    <h1>Draft Page</h1>
    <p>This is an unpublished draft. Move it out of the unpublished folder to make it public.</p>
</body>
</html>`
      
      // Create the main index file
      const response = await fetch(getApiUrl('/api/files/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: fullPath,
          content: indexContent,
          contentType: 'text/html'
        })
      })
      
      if (response.ok) {
        // Create the unpublished folder with a draft file
        await fetch(getApiUrl('/api/files/save'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: unpublishedPath,
            content: draftContent,
            contentType: 'text/html'
          })
        })
        
        await loadFiles()
        // Auto-expand the parent folder to show the new folder
        if (parentPath) {
          setExpandedFolders(prev => new Set([...prev, parentPath]))
        }
      }
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }

  const handleDelete = async (node: FileNode) => {
    try {
      const response = await fetch(getApiUrl('/api/files/delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: node.path,
          type: node.type
        })
      })
      
      if (response.ok) {
        await loadFiles()
        if (selectedFile?.path === node.path) {
          onFileSelect(null as any)
        }
      }
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const handleRename = async (node: FileNode, newName: string) => {
    try {
      const response = await fetch(getApiUrl('/api/files/rename'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPath: node.path,
          newName,
          type: node.type
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        await loadFiles()
        
        // If the renamed file was selected, update selection with new path
        if (selectedFile?.path === node.path) {
          onFileSelect({
            ...selectedFile,
            name: newName,
            path: data.newPath
          })
        }
      }
    } catch (error) {
      console.error('Failed to rename:', error)
    }
  }

  const handleDuplicate = async (node: FileNode) => {
    try {
      const response = await fetch(getApiUrl('/api/files/duplicate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: node.path,
          type: node.type
        })
      })
      
      if (response.ok) {
        await loadFiles()
      }
    } catch (error) {
      console.error('Failed to duplicate:', error)
    }
  }

  const handlePublish = async (node: FileNode) => {
    try {
      // Move file out of unpublished folder
      const targetPath = node.path.replace('/unpublished/', '/')
      
      const response = await fetch(getApiUrl('/api/files/move'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePath: node.path,
          targetPath
        })
      })
      
      if (response.ok) {
        await loadFiles()
      }
    } catch (error) {
      console.error('Failed to publish:', error)
    }
  }

  const handleUnpublish = async (node: FileNode) => {
    try {
      // Move file into unpublished folder
      const pathParts = node.path.split('/')
      const fileName = pathParts.pop()
      pathParts.push('unpublished', fileName!)
      const targetPath = pathParts.join('/')
      
      const response = await fetch(getApiUrl('/api/files/move'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePath: node.path,
          targetPath
        })
      })
      
      if (response.ok) {
        await loadFiles()
      }
    } catch (error) {
      console.error('Failed to unpublish:', error)
    }
  }


  const sortNodes = (nodes: FileNode[]): FileNode[] => {
    return [...nodes].sort((a, b) => {
      let comparison = 0
      
      // Folders first, then files
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1
      }
      
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
          const aExt = a.name.split('.').pop() || ''
          const bExt = b.name.split('.').pop() || ''
          comparison = aExt.localeCompare(bExt)
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }

  const filterNodes = (node: FileNode): FileNode | null => {
    if (!searchTerm) return node
    
    if (node.type === 'file') {
      return node.name.toLowerCase().includes(searchTerm.toLowerCase()) ? node : null
    }
    
    // For folders, filter children
    const filteredChildren = node.children
      ?.map(child => filterNodes(child))
      .filter(Boolean) as FileNode[] | undefined
    
    // Show folder if it matches or has matching children
    if (node.name.toLowerCase().includes(searchTerm.toLowerCase()) || (filteredChildren && filteredChildren.length > 0)) {
      return { ...node, children: filteredChildren }
    }
    
    return null
  }

  const renderNode = (node: FileNode, level: number = 0) => {
    const isFolder = node.type === 'folder'
    const isExpanded = expandedFolders.has(node.path)
    const isSelected = selectedFile?.path === node.path
    const isUnpublishedFolder = isFolder && node.name === 'unpublished'

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
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          {/* Icon */}
          <span className={`${isUnpublishedFolder ? 'text-orange-600' : 'text-gray-600'}`}>
            {isFolder ? (
              isUnpublishedFolder ? '🔒' :
              isExpanded ? '📂' : '📁'
            ) : (
              node.name.endsWith('.html') ? '📄' :
              node.name.endsWith('.css') ? '🎨' :
              node.name.endsWith('.js') ? '⚡' : '📎'
            )}
          </span>
          
          {/* Name */}
          <span className={`flex-1 text-sm ${isSelected ? 'font-semibold' : ''} ${isUnpublishedFolder ? 'text-orange-700 font-medium' : ''}`}>
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
            {sortNodes(node.children).map(child => {
              const filtered = filterNodes(child)
              return filtered ? renderNode(filtered, level + 1) : null
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="border-b border-gray-200 p-2 space-y-2">
          {/* Search */}
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          
          {/* Sort options */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
            >
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="date">Date</option>
              <option value="type">Type</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
            
            <button
              onClick={loadFiles}
              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
              title="Refresh"
            >
              🔄
            </button>
          </div>
        </div>

        {/* File tree */}
        <div 
          className="flex-1 overflow-y-auto py-2"
          onContextMenu={(e) => handleContextMenu(e, undefined, true)}
        >
          {loading && (
            <div className="p-4 text-center text-gray-500">
              Loading files...
            </div>
          )}
          
          {error && (
            <div className="p-4">
              <div className="text-red-600 text-sm">{error}</div>
            </div>
          )}
          
          {!loading && !error && files && files.children && (
            <>
              {files.children.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="mb-2">📭</div>
                  <div className="text-sm">No files found</div>
                  <div className="text-xs mt-1">Right-click to create your first file</div>
                </div>
              ) : (
                sortNodes(files.children).map(node => {
                  const filtered = filterNodes(node)
                  return filtered ? renderNode(filtered) : null
                })
              )}
            </>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onNewFile={() => setModal({ type: 'fileType', node: contextMenu.node })}
          onNewFolder={() => setModal({ type: 'newFolder', node: contextMenu.node })}
          onRename={contextMenu.node ? () => setModal({ type: 'rename', node: contextMenu.node }) : undefined}
          onDelete={contextMenu.node ? () => setModal({ type: 'delete', node: contextMenu.node }) : undefined}
          onDuplicate={contextMenu.node ? () => handleDuplicate(contextMenu.node!) : undefined}
          onPublish={contextMenu.node?.path.includes('/unpublished/') ? () => handlePublish(contextMenu.node!) : undefined}
          onUnpublish={contextMenu.node && !contextMenu.node.path.includes('/unpublished/') ? () => handleUnpublish(contextMenu.node!) : undefined}
          isRoot={contextMenu.isRoot}
          itemType={contextMenu.node?.type}
          fileName={contextMenu.node?.name}
          filePath={contextMenu.node?.path}
        />
      )}

      {/* Modals */}
      {modal.type === 'fileType' && (
        <FileModal
          isOpen={true}
          onClose={() => setModal({ type: null })}
          onConfirm={(fileType) => {
            // Store the file type temporarily
            (window as any).__tempFileType = fileType;
            setModal({ type: 'newFile', node: modal.node })
          }}
          title="Choose File Type"
          type="select"
          options={[
            { label: 'HTML File', value: 'html', icon: '📄' },
            { label: 'CSS File', value: 'css', icon: '🎨' },
            { label: 'JavaScript', value: 'js', icon: '⚡' },
            { label: 'Text File', value: 'txt', icon: '📝' }
          ]}
        />
      )}

      {modal.type === 'newFile' && (
        <FileModal
          isOpen={true}
          onClose={() => setModal({ type: null })}
          onConfirm={(fileName) => {
            const fileType = (window as any).__tempFileType || 'html'
            handleNewFile(modal.node?.path || '', fileName!, fileType)
            setModal({ type: null })
            delete (window as any).__tempFileType
          }}
          title="New File"
          type="input"
          inputLabel="File name (without extension)"
          inputPlaceholder="my-page"
        />
      )}

      {modal.type === 'newFolder' && (
        <FileModal
          isOpen={true}
          onClose={() => setModal({ type: null })}
          onConfirm={(folderName) => {
            handleNewFolder(modal.node?.path || '', folderName!)
            setModal({ type: null })
          }}
          title="New Folder"
          type="input"
          inputLabel="Folder name"
          inputPlaceholder="my-folder"
        />
      )}

      {modal.type === 'delete' && modal.node && (
        <FileModal
          isOpen={true}
          onClose={() => setModal({ type: null })}
          onConfirm={() => {
            handleDelete(modal.node!)
            setModal({ type: null })
          }}
          title={`Delete ${modal.node.type === 'folder' ? 'Folder' : 'File'}`}
          type="confirm"
          message={`Are you sure you want to delete "${modal.node.name}"?${
            modal.node.type === 'folder' ? ' This will delete all files inside the folder.' : ''
          }`}
        />
      )}

      {modal.type === 'rename' && modal.node && (
        <FileModal
          isOpen={true}
          onClose={() => setModal({ type: null })}
          onConfirm={(newName) => {
            handleRename(modal.node!, newName!)
            setModal({ type: null })
          }}
          title={`Rename ${modal.node.type === 'folder' ? 'Folder' : 'File'}`}
          type="input"
          inputLabel="New name"
          inputPlaceholder={modal.node.name}
          initialValue={modal.node.name.replace(/\.[^/.]+$/, '')} // Remove extension for files
        />
      )}
    </>
  )
}