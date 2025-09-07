'use client'

import { useState, useRef, memo, useCallback } from 'react'
import { FileNode } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { RotateCcw, Smartphone, Monitor, Copy, FileText, Globe, Maximize2 } from 'lucide-react'
import FileEditorContent, { FileEditorContentRef } from './FileEditorContent'

// Memoized header component to prevent visual refresh
const FileEditorHeader = memo(({ 
  file, 
  hasChanges, 
  preview, 
  previewMode, 
  onRefresh, 
  onCopyUrl, 
  onEdit, 
  onPreview, 
  onSave, 
  saving,
  onSetPreviewMode,
  onToggleFullScreen
}: {
  file: FileNode | null
  hasChanges: boolean
  preview: boolean
  previewMode: 'mobile' | 'desktop'
  onRefresh: () => void
  onCopyUrl: () => void
  onEdit: () => void
  onPreview: () => void
  onSave: () => void
  saving: boolean
  onSetPreviewMode: (mode: 'mobile' | 'desktop') => void
  onToggleFullScreen: () => void
}) => {
  if (!file) return null

  return (
    <div className="bg-white border-b border-gray-300 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">
          Working on:
        </span>
        <span className="font-semibold">
          {file.type === 'folder' ? `${file.name || '/'} (notes)` : file.name}
        </span>
        {hasChanges && (
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded border border-yellow-300">
            Modified
          </span>
        )}
        {file.isPublished && (
          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded flex items-center gap-1 border border-green-300">
            <Globe className="w-3 h-3" />
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {/* Mobile/Desktop/Fullscreen buttons - always reserved space */}
        <div className="flex items-center gap-1">
          {preview && (
            <>
              <Button
                variant={previewMode === 'mobile' ? "default" : "outline"}
                size="sm"
                onClick={() => onSetPreviewMode('mobile')}
                title="Mobile Preview"
                className="w-6 h-6 p-0"
              >
                <Smartphone className="w-3 h-3" />
              </Button>
              <Button
                variant={previewMode === 'desktop' ? "default" : "outline"}
                size="sm"
                onClick={() => onSetPreviewMode('desktop')}
                title="Desktop Preview"
                className="w-6 h-6 p-0"
              >
                <Monitor className="w-3 h-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleFullScreen}
                title="Toggle Full Screen"
                className="w-6 h-6 p-0"
              >
                <Maximize2 className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          title={file.type === 'folder' ? "Refresh folder notes" : "Refresh file content"}
          className="w-6 h-6 p-0"
        >
          <RotateCcw className="w-3 h-3" />
        </Button>
        
        {file.isPublished && file.publicUrl && (
          <Button
            variant="success"
            size="sm"
            onClick={onCopyUrl}
            title="Copy Public URL"
            className="text-xs px-2 py-1"
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy URL
          </Button>
        )}
        
        <div className="flex items-center gap-1">
          <Button
            variant={preview ? "outline" : "default"}
            size="sm"
            onClick={onEdit}
            className="text-xs px-2 py-1"
          >
            Edit
          </Button>
          <Button
            variant={preview ? "default" : "outline"}
            size="sm"
            onClick={onPreview}
            className="text-xs px-2 py-1"
          >
            Preview
          </Button>
        </div>
        
        <Button
          variant="default"
          size="sm"
          onClick={onSave}
          disabled={!hasChanges || saving}
          className="text-xs px-2 py-1"
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
})

FileEditorHeader.displayName = 'FileEditorHeader'

interface FileEditorProps {
  file: FileNode | null
  onToggleFullScreen?: () => void
}

export default function FileEditor({ file, onToggleFullScreen }: FileEditorProps) {
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('desktop')
  const [loading, setLoading] = useState(false)
  const contentRef = useRef<FileEditorContentRef>(null)

  const handleContentChange = useCallback((content: string, originalContent: string) => {
    setHasChanges(content !== originalContent)
  }, [])

  const handleSave = useCallback(async () => {
    if (!contentRef.current) return
    
    try {
      setSaving(true)
      await contentRef.current.saveFile()
      setHasChanges(false)
    } catch (err) {
      // Error is handled by the content component
    } finally {
      setSaving(false)
    }
  }, [])

  // Stable callback functions to prevent header re-renders
  const handleRefresh = useCallback(() => {
    contentRef.current?.refreshContent()
  }, [])

  const handleCopyUrl = useCallback(() => {
    if (file?.isPublished && file?.publicUrl) {
      navigator.clipboard.writeText(file.publicUrl)
    }
  }, [file?.isPublished, file?.publicUrl])

  const handleEdit = useCallback(() => setPreview(false), [])
  const handlePreview = useCallback(() => setPreview(true), [])
  const handleSetPreviewMode = useCallback((mode: 'mobile' | 'desktop') => setPreviewMode(mode), [])

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <FileText className="w-8 h-8 text-gray-400" />
          <div>Select a file to view or edit</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <FileEditorHeader
        file={file}
        hasChanges={hasChanges}
        preview={preview}
        previewMode={previewMode}
        onRefresh={handleRefresh}
        onCopyUrl={handleCopyUrl}
        onEdit={handleEdit}
        onPreview={handlePreview}
        onSave={handleSave}
        saving={saving}
        onSetPreviewMode={handleSetPreviewMode}
        onToggleFullScreen={onToggleFullScreen || (() => {})}
      />


      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-b-2 border-red-500 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Content Area - Only this part reloads when file changes */}
      <FileEditorContent
        ref={contentRef}
        file={file}
        preview={preview}
        previewMode={previewMode}
        onContentChange={handleContentChange}
        onError={setError}
        onLoadingChange={setLoading}
      />
    </div>
  )
}