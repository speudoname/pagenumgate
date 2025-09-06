'use client'

import { useState, useEffect } from 'react'
import { getApiUrl } from '@/lib/utils/api'

interface FileNode {
  name: string
  type: 'file' | 'folder'
  path: string
  url?: string
  isPublished?: boolean
  publicUrl?: string
}

interface FileEditorProps {
  file: FileNode | null
  onOpenAIChat?: (type: 'file' | 'folder', path: string) => void
}

export default function FileEditor({ file, onOpenAIChat }: FileEditorProps) {
  const [content, setContent] = useState<string>('')
  const [originalContent, setOriginalContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    if (file && file.type === 'file') {
      loadFileContent()
    } else {
      setContent('')
      setOriginalContent('')
    }
  }, [file])

  const loadFileContent = async () => {
    if (!file || !file.url) return
    
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(getApiUrl('/api/files/read'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: file.url,
          path: file.path 
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to load file content')
      }
      
      const data = await response.json()
      setContent(data.content)
      setOriginalContent(data.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file')
    } finally {
      setLoading(false)
    }
  }

  const saveFile = async () => {
    if (!file) return
    
    try {
      setSaving(true)
      setError(null)
      
      const response = await fetch(getApiUrl('/api/files/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: file.path,
          content,
          contentType: file.name.endsWith('.css') ? 'text/css' : 
                       file.name.endsWith('.js') ? 'application/javascript' : 
                       'text/html'
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to save file')
      }
      
      setOriginalContent(content)
      alert('File saved successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = content !== originalContent

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📝</div>
          <div>Select a file to view or edit</div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Loading file content...
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Editing:</span>
          <span className="font-semibold">{file.name}</span>
          {hasChanges && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
              Modified
            </span>
          )}
          {file.isPublished && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded flex items-center gap-1">
              🌐 Published
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {onOpenAIChat && (
            <button
              onClick={() => onOpenAIChat('file', file.path)}
              className="px-3 py-1.5 text-sm border border-purple-300 text-purple-700 hover:bg-purple-50 rounded flex items-center gap-1"
              title="Open AI Chat"
            >
              🤖 AI Chat
            </button>
          )}
          {file.isPublished && file.publicUrl && (
            <button
              onClick={() => navigator.clipboard.writeText(file.publicUrl!)}
              className="px-3 py-1.5 text-sm border border-green-300 text-green-700 hover:bg-green-50 rounded flex items-center gap-1"
              title="Copy Public URL"
            >
              📋 Copy URL
            </button>
          )}
          
          <button
            onClick={() => setPreview(!preview)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
          
          <button
            onClick={saveFile}
            disabled={!hasChanges || saving}
            className={`
              px-4 py-1.5 text-sm rounded font-medium
              ${hasChanges 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
            `}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* File Properties - shown for HTML files */}
      {file.name.endsWith('.html') && (
        <div className="bg-gray-50 border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">File Properties</h3>
              <div className="mt-1 text-xs text-gray-600">
                <div>Path: <code className="bg-gray-100 px-1 py-0.5 rounded">{file.path}</code></div>
                {file.isPublished ? (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-green-600">🌐 Published</span>
                    {file.publicUrl && (
                      <>
                        <span>•</span>
                        <a 
                          href={file.publicUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          View Live
                        </a>
                        <span>•</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(file.publicUrl!)}
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          Copy URL
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 text-gray-500">
                    📄 Not published (right-click file to publish)
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Editor/Preview */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {preview ? (
          <div className="h-full overflow-auto bg-white">
            {file.name.endsWith('.html') ? (
              <iframe
                srcDoc={content}
                className="w-full h-full border-0"
                title="Preview"
                sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation"
              />
            ) : (
              <pre className="h-full overflow-auto p-4 whitespace-pre-wrap font-mono text-sm">
                {content}
              </pre>
            )}
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full p-4 font-mono text-sm resize-none focus:outline-none bg-white"
            placeholder="Start editing..."
            spellCheck={false}
          />
        )}
      </div>
    </div>
  )
}