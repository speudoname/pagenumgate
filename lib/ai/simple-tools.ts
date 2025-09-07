import { put, del, list } from '@vercel/blob'

// Simple tool interface
interface Tool {
  name: string
  description: string
  input_schema: {
    type: string
    properties: Record<string, any>
    required: string[]
  }
}

// Just 5 simple tools - that's all we need!
export const simpleTools: Tool[] = [
  {
    name: 'create_file',
    description: 'Create a new HTML file',
    input_schema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'File name (e.g., "about.html", "contact.html")'
        },
        content: {
          type: 'string',
          description: 'Complete HTML content'
        }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'edit_file',
    description: 'Edit an existing file - can do partial edits or full replacement',
    input_schema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'File to edit'
        },
        content: {
          type: 'string',
          description: 'New content (full replacement)'
        },
        find: {
          type: 'string',
          description: 'Text to find and replace (for partial edits)'
        },
        replace: {
          type: 'string',
          description: 'Text to replace with (for partial edits)'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'read_file',
    description: 'Read a file',
    input_schema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'File to read'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'delete_file',
    description: 'Delete a file or folder',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File or folder to delete'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'list_files',
    description: 'List all files',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'rename_file',
    description: 'Rename a file',
    input_schema: {
      type: 'object',
      properties: {
        oldName: {
          type: 'string',
          description: 'Current file name'
        },
        newName: {
          type: 'string',
          description: 'New file name (with or without extension)'
        }
      },
      required: ['oldName', 'newName']
    }
  }
]

// Simple tool executor - no complex path resolution!
export async function executeSimpleTool(
  toolName: string,
  input: any,
  tenantId: string,
  currentFolder: string = ''
): Promise<any> {
  // Build the full path simply
  const buildPath = (filename: string) => {
    const parts = [tenantId]
    if (currentFolder && currentFolder !== '/') {
      // Clean the folder path - remove tenant ID if it's duplicated
      let cleanFolder = currentFolder.replace(/^\/+|\/+$/g, '')
      // Remove tenant ID if it's at the beginning of the folder path
      cleanFolder = cleanFolder.replace(new RegExp(`^${tenantId}/?`), '')
      if (cleanFolder) {
        parts.push(cleanFolder)
      }
    }
    if (filename) {
      // Clean the filename - remove any path parts and tenant ID
      let cleanFilename = filename.replace(/^\/+/, '')
      // If filename contains tenant ID, remove it
      cleanFilename = cleanFilename.replace(new RegExp(`^${tenantId}/?`), '')
      // Also remove any folder path from filename if it's already in currentFolder
      if (currentFolder && currentFolder !== '/' && cleanFilename.includes('/')) {
        cleanFilename = cleanFilename.split('/').pop() || cleanFilename
      }
      parts.push(cleanFilename)
    }
    return parts.filter(p => p).join('/')
  }

  try {
    switch (toolName) {
      case 'create_file': {
        const fullPath = buildPath(input.filename)
        const blob = await put(fullPath, input.content, {
          access: 'public',
          contentType: 'text/html',
          addRandomSuffix: false,
          allowOverwrite: true
        })
        return { success: true, message: `Created ${input.filename}`, url: blob.url }
      }

      case 'edit_file': {
        const fullPath = buildPath(input.filename)
        
        // If find/replace is specified, do partial edit
        if (input.find && input.replace !== undefined) {
          // First read the current content
          const { blobs } = await list({ prefix: fullPath, limit: 1 })
          if (blobs.length === 0) {
            throw new Error(`File not found: ${input.filename}`)
          }
          
          const response = await fetch(blobs[0].url)
          let content = await response.text()
          
          // Perform the replacement
          if (!content.includes(input.find)) {
            throw new Error(`Text not found in file: "${input.find}"`)
          }
          
          content = content.replace(input.find, input.replace)
          
          // Save the updated content
          const blob = await put(fullPath, content, {
            access: 'public',
            contentType: 'text/html',
            addRandomSuffix: false,
            allowOverwrite: true
          })
          return { success: true, message: `Updated ${input.filename} (partial edit)`, url: blob.url }
        } else if (input.content) {
          // Full content replacement
          const blob = await put(fullPath, input.content, {
            access: 'public',
            contentType: 'text/html',
            addRandomSuffix: false,
            allowOverwrite: true
          })
          return { success: true, message: `Updated ${input.filename}`, url: blob.url }
        } else {
          throw new Error('Either content or find/replace must be provided')
        }
      }

      case 'read_file': {
        const fullPath = buildPath(input.filename)
        const { blobs } = await list({ prefix: fullPath, limit: 1 })
        
        if (blobs.length === 0) {
          throw new Error(`File not found: ${input.filename}`)
        }
        
        const response = await fetch(blobs[0].url)
        const content = await response.text()
        
        return { success: true, content, filename: input.filename }
      }

      case 'delete_file': {
        const fullPath = buildPath(input.path)
        
        // List all files with this prefix (handles folders too)
        const { blobs } = await list({ prefix: fullPath })
        
        if (blobs.length === 0) {
          return { success: false, message: `Nothing found at: ${input.path}` }
        }
        
        // Delete all files
        await Promise.all(blobs.map(blob => del(blob.url)))
        
        return { 
          success: true, 
          message: `Deleted ${input.path}`,
          filesDeleted: blobs.length 
        }
      }

      case 'list_files': {
        const prefix = buildPath('')
        const { blobs } = await list({ prefix })
        
        // Clean up the file list
        const files = blobs.map(blob => {
          const path = blob.pathname
            .replace(tenantId + '/', '')
            .replace(currentFolder, '')
            .replace(/^\/+/, '')
          
          return {
            name: path,
            url: blob.url,
            size: blob.size
          }
        })
        
        return { success: true, files, count: files.length }
      }

      case 'rename_file': {
        const oldPath = buildPath(input.oldName)
        
        // Ensure new name has .html extension if missing
        let newName = input.newName
        if (!newName.endsWith('.html') && !newName.includes('.')) {
          newName += '.html'
        }
        const newPath = buildPath(newName)
        
        // Read the old file
        const { blobs } = await list({ prefix: oldPath, limit: 1 })
        if (blobs.length === 0) {
          throw new Error(`File not found: ${input.oldName}`)
        }
        
        const response = await fetch(blobs[0].url)
        const content = await response.text()
        
        // Create new file with same content
        await put(newPath, content, {
          access: 'public',
          contentType: 'text/html',
          addRandomSuffix: false,
          allowOverwrite: true
        })
        
        // Delete old file
        await del(blobs[0].url)
        
        return { 
          success: true, 
          message: `Renamed ${input.oldName} to ${newName}`,
          newName: newName
        }
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }
  } catch (error) {
    console.error(`Tool error [${toolName}]:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Tool execution failed' 
    }
  }
}