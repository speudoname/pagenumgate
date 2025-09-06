import { HTMLParser } from '../parsers/html-parser'
import { put, list } from '@vercel/blob'

// Define Tool interface matching the format in tools.ts
interface Tool {
  name: string
  description: string
  input_schema: {
    type: string
    properties: Record<string, any>
    required: string[]
  }
}

/**
 * DOM manipulation tools for precise page editing
 */

/**
 * Update a specific section of a page without affecting the rest
 */
export const updateSectionTool: Tool = {
  name: 'update_section',
  description: 'Update a specific section of an HTML page while preserving the rest of the content. Use this for targeted edits.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the HTML file to edit'
      },
      selector: {
        type: 'string',
        description: 'CSS selector for the element to update (e.g., "#hero", ".header", "section:first-of-type")'
      },
      new_content: {
        type: 'string',
        description: 'The new HTML content for the selected section'
      },
      preserve_attributes: {
        type: 'boolean',
        description: 'Whether to preserve existing attributes like id and classes',
        default: true
      }
    },
    required: ['path', 'selector', 'new_content']
  }
}

/**
 * Get the current structure and content of a page
 */
export const getPreviewStateTool: Tool = {
  name: 'get_preview_state',
  description: 'Get the current structure of an HTML page, including all sections and their content. Use this to understand what\'s on the page before making edits.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the HTML file to analyze'
      }
    },
    required: ['path']
  }
}

/**
 * Find elements by their text content
 */
export const findElementTool: Tool = {
  name: 'find_element',
  description: 'Find an element on the page by its text content. Returns the CSS selector for the element.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the HTML file'
      },
      text: {
        type: 'string',
        description: 'The text content to search for'
      },
      tag_name: {
        type: 'string',
        description: 'Optional: limit search to specific tag type (e.g., "h1", "p", "button")'
      }
    },
    required: ['path', 'text']
  }
}

/**
 * Update specific properties of an element
 */
export const updateElementTool: Tool = {
  name: 'update_element',
  description: 'Update the text, attributes, or classes of a specific element without changing its structure.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the HTML file'
      },
      selector: {
        type: 'string',
        description: 'CSS selector for the element to update'
      },
      updates: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'New text content for the element'
          },
          html: {
            type: 'string',
            description: 'New inner HTML for the element'
          },
          attributes: {
            type: 'object',
            description: 'Attributes to set (e.g., {"href": "https://example.com"})'
          },
          add_class: {
            type: 'array',
            items: { type: 'string' },
            description: 'Classes to add to the element'
          },
          remove_class: {
            type: 'array',
            items: { type: 'string' },
            description: 'Classes to remove from the element'
          }
        }
      }
    },
    required: ['path', 'selector', 'updates']
  }
}

/**
 * Add a new element to the page
 */
export const addElementTool: Tool = {
  name: 'add_element',
  description: 'Add a new element to the page at a specific position relative to an existing element.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the HTML file'
      },
      parent_selector: {
        type: 'string',
        description: 'CSS selector for the parent/reference element'
      },
      html: {
        type: 'string',
        description: 'The HTML content to add'
      },
      position: {
        type: 'string',
        enum: ['before', 'after', 'prepend', 'append'],
        description: 'Where to insert relative to parent (before/after as sibling, prepend/append as child)',
        default: 'append'
      }
    },
    required: ['path', 'parent_selector', 'html']
  }
}

/**
 * Remove an element from the page
 */
export const removeElementTool: Tool = {
  name: 'remove_element',
  description: 'Remove an element from the page.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the HTML file'
      },
      selector: {
        type: 'string',
        description: 'CSS selector for the element to remove'
      }
    },
    required: ['path', 'selector']
  }
}

/**
 * Get detailed information about an element
 */
export const inspectElementTool: Tool = {
  name: 'inspect_element',
  description: 'Get detailed information about a specific element including its attributes, classes, and content.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the HTML file'
      },
      selector: {
        type: 'string',
        description: 'CSS selector for the element to inspect'
      }
    },
    required: ['path', 'selector']
  }
}

/**
 * Execute DOM tool operations
 */
export async function executeDomTool(
  toolName: string,
  input: any,
  tenantId: string
): Promise<any> {
  const blobPath = `${tenantId}/${input.path}`
  
  try {
    // Get the current HTML content from blob storage
    const { blobs } = await list({
      prefix: blobPath,
      limit: 1
    })
    
    if (blobs.length === 0) {
      throw new Error('File not found')
    }
    
    const response = await fetch(blobs[0].url)
    if (!response.ok) {
      throw new Error('Failed to fetch file')
    }
    
    const currentHtml = await response.text()
    const parser = new HTMLParser(currentHtml)
    
    switch (toolName) {
      case 'update_section': {
        const success = parser.updateSection(
          input.selector,
          input.new_content,
          input.preserve_attributes !== false
        )
        
        if (success) {
          // Save the updated HTML
          const updatedHtml = parser.getHTML()
          await put(blobPath, updatedHtml, {
            access: 'public',
            contentType: 'text/html',
          })
          
          return {
            success: true,
            message: `Updated section ${input.selector}`,
            selector: input.selector
          }
        } else {
          throw new Error(`Could not find section with selector: ${input.selector}`)
        }
      }
      
      case 'get_preview_state': {
        const sections = parser.getSections()
        return {
          success: true,
          sections,
          total_sections: sections.length,
          structure_summary: sections.map(s => ({
            selector: s.selector,
            type: s.type,
            text_preview: s.innerText
          }))
        }
      }
      
      case 'find_element': {
        const selector = parser.findElementByText(input.text, input.tag_name)
        if (selector) {
          return {
            success: true,
            selector,
            found: true
          }
        } else {
          return {
            success: true,
            found: false,
            message: `No element found with text: "${input.text}"`
          }
        }
      }
      
      case 'update_element': {
        const success = parser.updateElement(input.selector, {
          text: input.updates.text,
          html: input.updates.html,
          attributes: input.updates.attributes,
          addClass: input.updates.add_class,
          removeClass: input.updates.remove_class
        })
        
        if (success) {
          const updatedHtml = parser.getHTML()
          await put(blobPath, updatedHtml, {
            access: 'public',
            contentType: 'text/html',
          })
          
          return {
            success: true,
            message: `Updated element ${input.selector}`,
            selector: input.selector
          }
        } else {
          throw new Error(`Could not find element with selector: ${input.selector}`)
        }
      }
      
      case 'add_element': {
        const success = parser.addElement(
          input.parent_selector,
          input.html,
          input.position || 'append'
        )
        
        if (success) {
          const updatedHtml = parser.getHTML()
          await put(blobPath, updatedHtml, {
            access: 'public',
            contentType: 'text/html',
          })
          
          return {
            success: true,
            message: `Added element to ${input.parent_selector}`,
            parent_selector: input.parent_selector,
            position: input.position || 'append'
          }
        } else {
          throw new Error(`Could not find parent element: ${input.parent_selector}`)
        }
      }
      
      case 'remove_element': {
        const success = parser.removeElement(input.selector)
        
        if (success) {
          const updatedHtml = parser.getHTML()
          await put(blobPath, updatedHtml, {
            access: 'public',
            contentType: 'text/html',
          })
          
          return {
            success: true,
            message: `Removed element ${input.selector}`,
            selector: input.selector
          }
        } else {
          throw new Error(`Could not find element: ${input.selector}`)
        }
      }
      
      case 'inspect_element': {
        const info = parser.getElementInfo(input.selector)
        
        if (info.exists) {
          return {
            success: true,
            ...info
          }
        } else {
          return {
            success: false,
            message: `Element not found: ${input.selector}`,
            exists: false
          }
        }
      }
      
      default:
        throw new Error(`Unknown DOM tool: ${toolName}`)
    }
  } catch (error) {
    throw error
  }
}

// Export all DOM tools as an array
export const domTools = [
  updateSectionTool,
  getPreviewStateTool,
  findElementTool,
  updateElementTool,
  addElementTool,
  removeElementTool,
  inspectElementTool
]