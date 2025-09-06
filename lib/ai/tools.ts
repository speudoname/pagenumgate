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

export function getTools(contextType: string | null, contextPath: string | null, tenantId: string): Tool[] {
  // Handle null/undefined contextPath and contextType
  const safeType = contextType || 'folder'
  const safePath = contextPath || ''
  
  // Calculate base path safely
  let basePath = ''
  if (safeType === 'folder') {
    basePath = safePath
  } else if (safePath && safePath.includes('/')) {
    const lastSlash = safePath.lastIndexOf('/')
    basePath = lastSlash > 0 ? safePath.substring(0, lastSlash) : ''
  }
  
  // Store context info for tools to use
  (global as any).__TOOL_CONTEXT = { contextType: safeType, contextPath: safePath, basePath, tenantId }
  
  // Combine file tools with DOM tools
  const fileTools = [
    {
      name: 'create_file',
      description: 'Create a new file with content. Use when user says: "create a page", "make a file", "build a page", "new page for X", "landing page", etc. ALWAYS extract filename from context.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path with extension. SMART EXTRACTION: If user mentions a name/topic (e.g., "for levan", "about products", "contact form"), use it as filename (e.g., "levan.html", "products.html", "contact.html"). Default to "index.html" if no name given. Always add appropriate extension (.html for pages, .css for styles, etc.)'
          },
          content: {
            type: 'string',
            description: 'Complete file content. SMART GENERATION: For HTML, create full valid document with DOCTYPE. Apply mentioned styles (brutal=bold borders/colors, modern=clean gradients, minimal=simple/white). Include ALL mentioned text/messages prominently. Add semantic HTML5 structure. Include responsive design.'
          },
          fileType: {
            type: 'string',
            description: 'Optional: Auto-detected from extension. Only specify if ambiguous.',
            enum: ['html', 'css', 'js', 'json', 'md', 'txt', 'xml', 'yaml']
          }
        },
        required: ['path', 'content']
      }
    },
    {
      name: 'edit_file',
      description: 'Edit/update existing file content. Use when user says: "change", "update", "modify", "fix", "improve", "add to", etc. MUST read file first to know current content.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to edit. SMART EXTRACTION: If user references "this file", "the page", "it" - use current context file. If they mention specific file like "the contact page", infer "contact.html".'
          },
          content: {
            type: 'string',
            description: 'New complete content. SMART EDITING: Preserve existing structure/styles unless told to change. Apply incremental changes. Keep file type consistency. Maintain any existing functionality.'
          }
        },
        required: ['path', 'content']
      }
    },
    {
      name: 'delete_file',
      description: 'Delete file or folder. Use when user says: "delete", "remove", "get rid of", "clean up", "trash", etc.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to delete. SMART EXTRACTION: If user says "this", "it", "the file" - use current context. If they say "everything", confirm scope. Handle "all X files" by listing first.'
          }
        },
        required: ['path']
      }
    },
    {
      name: 'read_file',
      description: 'Read file contents. Use when user says: "show", "what\'s in", "open", "view", "check", "look at", etc.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to read. SMART EXTRACTION: "this file"/"current" = context path. "the styles" = infer styles.css. "homepage" = index.html. Check common naming patterns.'
          }
        },
        required: ['path']
      }
    },
    {
      name: 'list_files',
      description: 'List directory contents. Use when user says: "what files", "show files", "list", "what\'s here", "directory contents", etc.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory to list. SMART DEFAULTS: Empty/null = current context directory. "here"/"this folder" = current context. "root" = tenant root. Auto-append / for folders.'
          }
        },
        required: []
      }
    },
    {
      name: 'create_folder',
      description: 'Create new folder/directory. Use when user says: "create folder", "make directory", "new folder", "organize into", etc.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Folder path. SMART EXTRACTION: Extract name from context (e.g., "for images" → "images/", "components folder" → "components/"). Create nested paths if mentioned.'
          }
        },
        required: ['path']
      }
    },
    {
      name: 'move_file',
      description: 'Move or rename files. Use when user says: "rename", "move", "change name", "relocate", "organize", etc.',
      input_schema: {
        type: 'object',
        properties: {
          from: {
            type: 'string',
            description: 'Source path. SMART EXTRACTION: "this file" = current context. Handle wildcards conceptually (e.g., "all images" = iterate image files).'
          },
          to: {
            type: 'string',
            description: 'Destination path. SMART EXTRACTION: For renames, keep same directory. For moves, preserve filename unless changing. Handle "to X folder" patterns.'
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
  logger.log('=== EXECUTE TOOL CALL ===')
  logger.log(`Tool: ${tool.name}`)
  logger.log(`Input:`, JSON.stringify(tool.input, null, 2))
  logger.log(`Tenant: ${tenantId}`)
  logger.log(`User: ${userId}`)
  
  // Get context info set by getTools
  const context = (global as any).__TOOL_CONTEXT || {}
  logger.log(`Context:`, context)
  
  // Resolve path with context awareness
  const resolvePathWithContext = (inputPath: string) => {
    if (!inputPath) {
      throw new Error('Path is required')
    }
    
    let resolvedPath = inputPath
    
    // If we're in folder context and path doesn't start with that folder, prefix it
    if (context.contextType === 'folder' && context.contextPath && typeof context.contextPath === 'string') {
      // If path is just a filename (no / in it) or doesn't start with context path
      if (!inputPath.includes('/') || !inputPath.startsWith(context.contextPath)) {
        // Don't double-prefix if already includes context path
        if (!inputPath.startsWith(context.contextPath)) {
          // Clean up any leading slashes from both parts
          const cleanContext = context.contextPath.replace(/\/$/, '')
          const cleanInput = inputPath.replace(/^\//, '')
          resolvedPath = cleanContext ? `${cleanContext}/${cleanInput}` : cleanInput
        }
      }
    }
    
    logger.log(`Path resolution: "${inputPath}" → "${resolvedPath}"`)
    return resolvedPath
  }
  
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
        const resolvedPath = resolvePathWithContext(path)
        const fullPath = sanitizePath(resolvedPath)
        
        // Determine content type based on file extension or fileType
        const ext = path.split('.').pop() || fileType || 'txt'
        const contentType = getContentType(ext)
        
        // Upload to blob storage
        logger.log(`Attempting blob PUT to: ${fullPath}`)
        logger.log(`Content length: ${content.length}`)
        logger.log(`Content type: ${contentType}`)
        
        try {
          const blob = await put(fullPath, content, {
            access: 'public',
            contentType,
          })
          
          logger.log(`Blob PUT successful! URL: ${blob.url}`)
          
          return {
            success: true,
            message: `File created at ${resolvedPath}`,
            url: blob.url
          }
        } catch (blobError) {
          logger.error('Blob PUT failed:', blobError)
          logger.error('Full error:', JSON.stringify(blobError, null, 2))
          throw blobError
        }
      }

      case 'edit_file': {
        const { path, content } = tool.input
        const resolvedPath = resolvePathWithContext(path)
        const fullPath = sanitizePath(resolvedPath)
        
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
          message: `File updated at ${resolvedPath}`,
          url: blob.url
        }
      }

      case 'delete_file': {
        const { path } = tool.input
        const resolvedPath = resolvePathWithContext(path)
        const fullPath = sanitizePath(resolvedPath)
        
        // Delete from blob storage
        await del(fullPath)
        
        return {
          success: true,
          message: `Deleted ${resolvedPath}`
        }
      }

      case 'read_file': {
        const { path } = tool.input
        const resolvedPath = resolvePathWithContext(path)
        const fullPath = sanitizePath(resolvedPath)
        
        // Fetch from blob storage using the Vercel Blob API
        const { blobs } = await list({
          prefix: fullPath,
          limit: 1
        })
        
        if (blobs.length === 0) {
          throw new Error(`File not found: ${resolvedPath}`)
        }
        
        const response = await fetch(blobs[0].url)
        if (!response.ok) {
          throw new Error(`File not found: ${resolvedPath}`)
        }
        
        const content = await response.text()
        
        return {
          success: true,
          content,
          path: resolvedPath
        }
      }

      case 'list_files': {
        const { path = '' } = tool.input
        // If no path provided and we're in folder context, use context folder
        let listPath = path
        if (!path && context.contextType === 'folder' && context.contextPath) {
          listPath = context.contextPath
        }
        const prefix = listPath ? sanitizePath(listPath) : `${tenantId}/`
        
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
        const resolvedPath = resolvePathWithContext(path)
        const fullPath = sanitizePath(resolvedPath)
        
        // Create a placeholder file in the folder
        const placeholderPath = `${fullPath}/.placeholder`
        await put(placeholderPath, '', {
          access: 'public',
          contentType: 'text/plain',
        })
        
        return {
          success: true,
          message: `Folder created at ${resolvedPath}`
        }
      }

      case 'move_file': {
        const { from, to } = tool.input
        const resolvedFrom = resolvePathWithContext(from)
        const resolvedTo = resolvePathWithContext(to)
        const fromPath = sanitizePath(resolvedFrom)
        const toPath = sanitizePath(resolvedTo)
        
        // Fetch the original file using Vercel Blob API
        const { blobs } = await list({
          prefix: fromPath,
          limit: 1
        })
        
        if (blobs.length === 0) {
          throw new Error(`Source file not found: ${resolvedFrom}`)
        }
        
        const response = await fetch(blobs[0].url)
        if (!response.ok) {
          throw new Error(`Source file not found: ${resolvedFrom}`)
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
          message: `Moved ${resolvedFrom} to ${resolvedTo}`
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