import { put, del, list } from '@vercel/blob'
import { logger } from '@/lib/utils/logger'
import { domTools, executeDomTool } from './tools/dom-tools'
import { pageTools, executePageTool } from './tools/page-tools'
import { businessTools, executeBusinessTool } from './tools/business-tools'

interface Tool {
  name: string
  description: string
  input_schema: {
    type: string
    properties: Record<string, any>
    required: string[]
  }
}

export function getTools(contextType: string, contextPath: string, tenantId: string): Tool[] {
  const basePath = contextType === 'folder' ? contextPath : contextPath.substring(0, contextPath.lastIndexOf('/'))
  
  // Combine file tools with DOM tools
  const fileTools = [
    {
      name: 'create_file',
      description: 'Create a new file with content',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path relative to current context'
          },
          content: {
            type: 'string',
            description: 'Content of the file'
          },
          fileType: {
            type: 'string',
            description: 'File type (html, css, js, json, etc.)',
            enum: ['html', 'css', 'js', 'json', 'md', 'txt', 'xml', 'yaml']
          }
        },
        required: ['path', 'content']
      }
    },
    {
      name: 'edit_file',
      description: 'Edit an existing file by replacing content',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to edit'
          },
          content: {
            type: 'string',
            description: 'New content for the file'
          }
        },
        required: ['path', 'content']
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
            description: 'Path to delete'
          }
        },
        required: ['path']
      }
    },
    {
      name: 'read_file',
      description: 'Read the contents of a file',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to read'
          }
        },
        required: ['path']
      }
    },
    {
      name: 'list_files',
      description: 'List files in a directory',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path to list (optional, defaults to current context)'
          }
        },
        required: []
      }
    },
    {
      name: 'create_folder',
      description: 'Create a new folder',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Folder path to create'
          }
        },
        required: ['path']
      }
    },
    {
      name: 'move_file',
      description: 'Move or rename a file',
      input_schema: {
        type: 'object',
        properties: {
          from: {
            type: 'string',
            description: 'Source file path'
          },
          to: {
            type: 'string',
            description: 'Destination file path'
          }
        },
        required: ['from', 'to']
      }
    }
  ]
  
  // Combine all tools: file operations, DOM manipulation, page building, and business integrations
  const allTools = [...fileTools, ...domTools, ...pageTools, ...businessTools]
  
  return allTools
}

export async function executeToolCall(
  tool: { name: string, input: any },
  tenantId: string,
  userId: string
): Promise<any> {
  logger.log(`Executing tool: ${tool.name}`, tool.input)
  
  // Ensure all paths are within tenant's directory
  const sanitizePath = (path: string) => {
    // Remove leading slash if present
    path = path.startsWith('/') ? path.substring(1) : path
    // Ensure path doesn't escape tenant directory
    if (path.includes('..')) {
      throw new Error('Invalid path: cannot navigate outside tenant directory')
    }
    return `${tenantId}/${path}`
  }

  try {
    switch (tool.name) {
      case 'create_file': {
        const { path, content, fileType } = tool.input
        const fullPath = sanitizePath(path)
        
        // Determine content type based on file extension or fileType
        const ext = path.split('.').pop() || fileType || 'txt'
        const contentType = getContentType(ext)
        
        // Upload to blob storage
        const blob = await put(fullPath, content, {
          access: 'public',
          contentType,
        })
        
        return {
          success: true,
          message: `File created at ${path}`,
          url: blob.url
        }
      }

      case 'edit_file': {
        const { path, content } = tool.input
        const fullPath = sanitizePath(path)
        
        // Get file extension to determine content type
        const ext = path.split('.').pop() || 'txt'
        const contentType = getContentType(ext)
        
        // Update in blob storage (put overwrites existing)
        const blob = await put(fullPath, content, {
          access: 'public',
          contentType,
        })
        
        return {
          success: true,
          message: `File updated at ${path}`,
          url: blob.url
        }
      }

      case 'delete_file': {
        const { path } = tool.input
        const fullPath = sanitizePath(path)
        
        // Delete from blob storage
        await del(fullPath)
        
        return {
          success: true,
          message: `Deleted ${path}`
        }
      }

      case 'read_file': {
        const { path } = tool.input
        const fullPath = sanitizePath(path)
        
        // Fetch from blob storage using the Vercel Blob API
        const { blobs } = await list({
          prefix: fullPath,
          limit: 1
        })
        
        if (blobs.length === 0) {
          throw new Error(`File not found: ${path}`)
        }
        
        const response = await fetch(blobs[0].url)
        if (!response.ok) {
          throw new Error(`File not found: ${path}`)
        }
        
        const content = await response.text()
        
        return {
          success: true,
          content,
          path
        }
      }

      case 'list_files': {
        const { path = '' } = tool.input
        const prefix = path ? sanitizePath(path) : `${tenantId}/`
        
        // List blobs with prefix
        const { blobs } = await list({
          prefix,
        })
        
        // Format the file list
        const files = blobs.map(blob => ({
          name: blob.pathname.replace(prefix, '').replace(/^\//, ''),
          size: blob.size,
          type: blob.pathname.endsWith('/') ? 'folder' : 'file',
          url: blob.url,
          lastModified: blob.uploadedAt
        }))
        
        return {
          success: true,
          files,
          count: files.length
        }
      }

      case 'create_folder': {
        const { path } = tool.input
        const fullPath = sanitizePath(path)
        
        // Create a placeholder file in the folder
        const placeholderPath = `${fullPath}/.placeholder`
        await put(placeholderPath, '', {
          access: 'public',
          contentType: 'text/plain',
        })
        
        return {
          success: true,
          message: `Folder created at ${path}`
        }
      }

      case 'move_file': {
        const { from, to } = tool.input
        const fromPath = sanitizePath(from)
        const toPath = sanitizePath(to)
        
        // Fetch the original file using Vercel Blob API
        const { blobs } = await list({
          prefix: fromPath,
          limit: 1
        })
        
        if (blobs.length === 0) {
          throw new Error(`Source file not found: ${from}`)
        }
        
        const response = await fetch(blobs[0].url)
        if (!response.ok) {
          throw new Error(`Source file not found: ${from}`)
        }
        
        const content = await response.blob()
        
        // Upload to new location
        const ext = to.split('.').pop() || 'txt'
        const contentType = getContentType(ext)
        
        await put(toPath, content, {
          access: 'public',
          contentType,
        })
        
        // Delete original
        await del(fromPath)
        
        return {
          success: true,
          message: `Moved ${from} to ${to}`
        }
      }

      default:
        // Check if it's a DOM tool
        const domToolNames = [
          'update_section',
          'get_preview_state',
          'find_element',
          'update_element',
          'add_element',
          'remove_element',
          'inspect_element'
        ]
        
        if (domToolNames.includes(tool.name)) {
          return await executeDomTool(tool.name, tool.input, tenantId)
        }
        
        // Check if it's a page building tool
        const pageToolNames = [
          'add_section',
          'apply_theme',
          'update_layout',
          'optimize_seo',
          'add_component'
        ]
        
        if (pageToolNames.includes(tool.name)) {
          return await executePageTool(tool.name, tool.input, tenantId)
        }
        
        // Check if it's a business tool
        const businessToolNames = [
          'add_webinar_registration',
          'add_payment_form',
          'add_lms_course_card',
          'add_testimonial_section',
          'add_opt_in_form',
          'add_product_showcase'
        ]
        
        if (businessToolNames.includes(tool.name)) {
          return await executeBusinessTool(tool.name, tool.input, tenantId)
        }
        
        throw new Error(`Unknown tool: ${tool.name}`)
    }
  } catch (error) {
    logger.error(`Tool execution error for ${tool.name}:`, error)
    throw error
  }
}

function getContentType(extension: string): string {
  const contentTypes: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'md': 'text/markdown',
    'txt': 'text/plain',
    'xml': 'application/xml',
    'yaml': 'text/yaml',
    'yml': 'text/yaml',
    'svg': 'image/svg+xml',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'pdf': 'application/pdf',
  }
  
  return contentTypes[extension.toLowerCase()] || 'text/plain'
}