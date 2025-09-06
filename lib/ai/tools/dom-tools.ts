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
  description: 'Update section of HTML page. Use when user says: "change the header", "update hero", "modify footer", "fix navigation", "replace section", etc.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'HTML file path. SMART EXTRACTION: "this page" = current context. "homepage" = index.html. Infer from conversation.'
      },
      selector: {
        type: 'string',
        description: 'CSS selector. SMART MAPPING: "header" → "header,#header,.header", "hero" → "#hero,.hero,section:first", "footer" → "footer,#footer,.footer". Handle natural language.'
      },
      new_content: {
        type: 'string',
        description: 'New HTML content. SMART GENERATION: Keep existing styles unless changing. Add responsive classes. Use semantic HTML5. Preserve links/functionality.'
      },
      preserve_attributes: {
        type: 'boolean',
        description: 'Keep existing IDs/classes. DEFAULT: true unless user wants complete replacement.',
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
  description: 'Analyze HTML structure/content. Use when user says: "show preview", "what\'s on the page", "analyze structure", "check layout", "inspect page", etc.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'HTML file to analyze. SMART DEFAULTS: Empty/"this" = current context. Auto-add .html if missing. "homepage" = index.html.'
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
  description: 'Find element by text. Use when user says: "find text X", "where does it say Y", "locate the button that says", "search for", etc.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'HTML file to search. SMART DEFAULT: Current context if not specified.'
      },
      text: {
        type: 'string',
        description: 'Text to find. SMART EXTRACTION: Extract exact or partial text from user request. Handle quotes and case variations.'
      },
      tag_name: {
        type: 'string',
        description: 'Tag filter. SMART MAPPING: "heading" → "h1,h2,h3", "button" → "button", "link" → "a", "paragraph" → "p".'
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
  description: 'Update element properties. Use when user says: "change button text", "update link", "add class", "modify attributes", "style element", etc.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'HTML file. SMART DEFAULT: Current context if not specified.'
      },
      selector: {
        type: 'string',
        description: 'Element selector. SMART EXTRACTION: "the button" → "button", "main heading" → "h1", "first link" → "a:first-of-type". Be specific.'
      },
      updates: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'New text. EXTRACT from user: "change text to X", "make it say Y".'
          },
          html: {
            type: 'string',
            description: 'New inner HTML. Use when adding formatted content, icons, or nested elements.'
          },
          attributes: {
            type: 'object',
            description: 'Attributes. SMART MAPPING: "link to X" → {"href": "X"}, "new image" → {"src": "X"}.'
          },
          add_class: {
            type: 'array',
            items: { type: 'string' },
            description: 'Classes to add. EXTRACT: "make it red" → ["text-red-500"], "center it" → ["text-center"].'
          },
          remove_class: {
            type: 'array',
            items: { type: 'string' },
            description: 'Classes to remove. EXTRACT: "remove styling" → all style classes.'
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
  description: 'Add new HTML element. Use when user says: "add button", "insert image", "create form", "put section", "include", etc.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'HTML file. SMART DEFAULT: Current context.'
      },
      parent_selector: {
        type: 'string',
        description: 'Where to add. SMART EXTRACTION: "in header" → "header", "after title" → "h1", "at end" → "body", "in main" → "main".'
      },
      html: {
        type: 'string',
        description: 'HTML to insert. SMART GENERATION: Create complete valid HTML. Add Tailwind classes. Match existing styles. Include responsive design.'
      },
      position: {
        type: 'string',
        enum: ['before', 'after', 'prepend', 'append'],
        description: 'Position. SMART MAPPING: "at start" → prepend, "at end" → append, "after X" → after, "before Y" → before',
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
  description: 'Remove element from page. Use when user says: "delete", "remove", "take out", "get rid of", "clean up", etc.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'HTML file. SMART DEFAULT: Current context.'
      },
      selector: {
        type: 'string',
        description: 'Element to remove. SMART EXTRACTION: "the banner" → "#banner,.banner", "all ads" → ".ad", "empty paragraphs" → "p:empty". Be careful with broad selectors.'
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
  description: 'Get element details. Use when user says: "inspect", "what styles", "check properties", "analyze element", "show attributes", etc.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'HTML file. SMART DEFAULT: Current context.'
      },
      selector: {
        type: 'string',
        description: 'Element to inspect. SMART EXTRACTION: Natural language to CSS. "the button" → "button:first", "all headings" → "h1,h2,h3".'
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