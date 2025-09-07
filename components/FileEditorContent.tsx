'use client'

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { getApiUrl } from '@/lib/utils/api'
import { FileNode } from '@/lib/types'

interface FileEditorContentProps {
  file: FileNode | null
  preview: boolean
  previewMode: 'mobile' | 'desktop'
  onContentChange: (content: string, originalContent: string) => void
  onError: (error: string | null) => void
  onLoadingChange: (loading: boolean) => void
}

export interface FileEditorContentRef {
  saveFile: () => Promise<void>
  refreshContent: () => void
  getContent: () => string
}

const FileEditorContent = forwardRef<FileEditorContentRef, FileEditorContentProps>(
  ({ file, preview, previewMode, onContentChange, onError, onLoadingChange }, ref) => {
    const [content, setContent] = useState<string>('')
    const [originalContent, setOriginalContent] = useState<string>('')
    const [loading, setLoading] = useState(false)

    const loadFileContent = async () => {
      if (!file || file.type !== 'file' || !file.url) return
      
      try {
        setLoading(true)
        onLoadingChange(true)
        onError(null)
        
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
        onContentChange(data.content, data.content)
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to load file')
      } finally {
        setLoading(false)
        onLoadingChange(false)
      }
    }

    const loadFolderNotes = async () => {
      if (!file || file.type !== 'folder') return
      
      try {
        setLoading(true)
        onLoadingChange(true)
        onError(null)
        
        const notesPath = file.path === '/' ? '.notes.md' : `${file.path}/.notes.md`
        
        const response = await fetch(getApiUrl('/api/files/read-folder-notes'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            path: notesPath
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          setContent(data.content || '')
          setOriginalContent(data.content || '')
          onContentChange(data.content || '', data.content || '')
        } else {
          // No notes file exists yet, start with empty content
          setContent('')
          setOriginalContent('')
          onContentChange('', '')
        }
      } catch (err) {
        // No notes file exists yet, that's ok - start with empty content
        setContent('')
        setOriginalContent('')
        onContentChange('', '')
      } finally {
        setLoading(false)
        onLoadingChange(false)
      }
    }

    const saveFile = async () => {
      if (!file) return
      
      try {
        onError(null)
        
        // For folders, save as .notes.md
        if (file.type === 'folder') {
          const notesPath = file.path === '/' ? '.notes.md' : `${file.path}/.notes.md`
          
          const response = await fetch(getApiUrl('/api/files/save'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: notesPath,
              content,
              contentType: 'text/markdown'
            })
          })
          
          if (!response.ok) {
            throw new Error('Failed to save folder notes')
          }
        } else {
          // Regular file save
          const response = await fetch(getApiUrl('/api/files/save'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: file.path,
              content,
              contentType: file.name.endsWith('.css') ? 'text/css' : 
                           file.name.endsWith('.js') ? 'application/javascript' : 
                           file.name.endsWith('.md') ? 'text/markdown' :
                           'text/html'
            })
          })
          
          if (!response.ok) {
            throw new Error('Failed to save file')
          }
        }
        
        setOriginalContent(content)
        onContentChange(content, content)
        alert('Saved successfully!')
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to save')
        throw err
      }
    }

    const refreshContent = () => {
      if (file) {
        if (file.type === 'file') {
          loadFileContent()
        } else if (file.type === 'folder') {
          loadFolderNotes()
        }
      }
    }

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      saveFile,
      refreshContent,
      getContent: () => content
    }))

    // Load content when file changes
    useEffect(() => {
      if (file) {
        if (file.type === 'file') {
          loadFileContent()
        } else if (file.type === 'folder') {
          loadFolderNotes()
        }
      } else {
        setContent('')
        setOriginalContent('')
        onContentChange('', '')
      }
    }, [file?.path, file?.type]) // Only re-run when path or type changes

    const handleContentChange = (newContent: string) => {
      setContent(newContent)
      onContentChange(newContent, originalContent)
    }

    if (!file) {
      return null
    }

    if (loading) {
      return (
        <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
          <div className="text-gray-500">Loading file content...</div>
        </div>
      )
    }

    return (
      <div className="flex-1 min-h-0 overflow-hidden">
        {preview ? (
          <div className="h-full overflow-hidden">
            {file.name.endsWith('.html') ? (
              <div className={`h-full ${previewMode === 'mobile' ? 'max-w-sm mx-auto' : 'w-full'}`}>
                <iframe
                  srcDoc={content}
                  className={`w-full h-full border-0 ${previewMode === 'mobile' ? 'max-w-sm' : ''}`}
                  title={`${previewMode} Preview`}
                  sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation"
                />
              </div>
            ) : (
              <pre className="h-full overflow-auto whitespace-pre-wrap font-mono text-sm p-4">
                {content}
              </pre>
            )}
          </div>
        ) : (
          <div className="h-full overflow-hidden p-2">
            <div className="h-full bg-white border-2 border-black rounded-md shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                className="w-full h-full p-3 font-mono text-sm resize-none focus:outline-none bg-transparent border-none"
                placeholder={file.type === 'folder' ? 'Add notes for this folder...' : 'Start typing...'}
                spellCheck={false}
              />
            </div>
          </div>
        )}
      </div>
    )
  }
)

FileEditorContent.displayName = 'FileEditorContent'

export default FileEditorContent