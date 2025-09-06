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
 * Aggressively highlight text elements with high-contrast colors
 */
export const highlightTextTool: Tool = {
  name: 'highlight_text',
  description: 'Aggressively highlight text with high-contrast colors. Use when user says: "highlight", "make stand out", "emphasize", "mark text", "color text aggressively", etc.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'HTML file. SMART DEFAULT: Current context.'
      },
      selector: {
        type: 'string',
        description: 'Elements to highlight. SMART EXTRACTION: "all headings" → "h1,h2,h3,h4,h5,h6", "main text" → "p", "everything" → "*", "title" → "h1", specific selectors as-is.'
      },
      style: {
        type: 'string',
        enum: ['neon', 'danger', 'warning', 'success', 'brutal', 'glow', 'rainbow'],
        description: 'Highlight style. SMART MAPPING: "aggressive" → "brutal", "bright" → "neon", "alert" → "danger", "colorful" → "rainbow"',
        default: 'brutal'
      },
      intensity: {
        type: 'number',
        description: 'Intensity level 1-10. Higher = more aggressive. DEFAULT: 10 for maximum impact.',
        default: 10
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
      
      case 'highlight_text': {
        // Define aggressive highlight styles
        const styles: Record<string, string> = {
          neon: `
            background: linear-gradient(45deg, #ff00ff, #00ffff, #ffff00, #ff00ff) !important;
            background-size: 400% 400% !important;
            animation: neonPulse 2s ease infinite !important;
            color: #000 !important;
            font-weight: 900 !important;
            text-shadow: 0 0 20px #fff, 0 0 30px #ff00ff, 0 0 40px #ff00ff !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
          `,
          danger: `
            background: #ff0000 !important;
            color: #ffffff !important;
            font-weight: 900 !important;
            padding: 8px 16px !important;
            border: 4px solid #000000 !important;
            box-shadow: 0 0 20px rgba(255,0,0,0.8) !important;
            animation: dangerPulse 0.5s ease infinite !important;
          `,
          warning: `
            background: #ffff00 !important;
            color: #000000 !important;
            font-weight: 900 !important;
            padding: 8px 16px !important;
            border: 4px solid #ff9900 !important;
            text-decoration: underline wavy #ff0000 !important;
            animation: warningShake 0.2s ease infinite !important;
          `,
          success: `
            background: #00ff00 !important;
            color: #000000 !important;
            font-weight: 900 !important;
            padding: 8px 16px !important;
            border: 4px solid #008800 !important;
            box-shadow: 0 0 30px rgba(0,255,0,0.8) !important;
          `,
          brutal: `
            background: #000000 !important;
            color: #ffff00 !important;
            font-weight: 900 !important;
            font-size: 120% !important;
            padding: 12px 20px !important;
            border: 8px solid #ffff00 !important;
            box-shadow: 8px 8px 0 #ff00ff, 16px 16px 0 #00ffff !important;
            transform: rotate(-2deg) !important;
            display: inline-block !important;
          `,
          glow: `
            background: linear-gradient(90deg, #ff00ff, #ffff00, #00ffff, #ff00ff) !important;
            background-size: 200% 100% !important;
            animation: glowMove 1s linear infinite !important;
            color: #000000 !important;
            font-weight: 900 !important;
            padding: 10px 20px !important;
            border-radius: 50px !important;
            box-shadow: 0 0 40px currentColor !important;
          `,
          rainbow: `
            background: linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet) !important;
            background-size: 400% 100% !important;
            animation: rainbowMove 3s ease infinite !important;
            color: #ffffff !important;
            font-weight: 900 !important;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8) !important;
            padding: 8px 16px !important;
            border: 4px solid #000 !important;
          `
        }
        
        const selectedStyle = styles[input.style || 'brutal'] || styles.brutal
        const intensity = input.intensity || 10
        
        // Scale some properties based on intensity
        const scaledStyle = selectedStyle.replace(/padding: ([\d]+)px/g, (match, p1) => {
          return `padding: ${Math.round(parseInt(p1) * (intensity / 10))}px`
        }).replace(/border: ([\d]+)px/g, (match, p1) => {
          return `border: ${Math.round(parseInt(p1) * (intensity / 10))}px`
        })
        
        // Add animation keyframes to the document
        const animationStyles = `
          @keyframes neonPulse {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes dangerPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          @keyframes warningShake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-2px); }
            75% { transform: translateX(2px); }
          }
          @keyframes glowMove {
            0% { background-position: 0% 50%; }
            100% { background-position: 100% 50%; }
          }
          @keyframes rainbowMove {
            0% { background-position: 0% 50%; }
            100% { background-position: 100% 50%; }
          }
        `
        
        // Apply highlight styles to selected elements
        const success = parser.highlightElements(input.selector, scaledStyle, animationStyles)
        
        if (success) {
          const updatedHtml = parser.getHTML()
          await put(blobPath, updatedHtml, {
            access: 'public',
            contentType: 'text/html',
          })
          
          return {
            success: true,
            message: `Applied ${input.style || 'brutal'} highlighting to ${input.selector}`,
            selector: input.selector,
            style: input.style || 'brutal',
            intensity: intensity
          }
        } else {
          throw new Error(`Could not find elements: ${input.selector}`)
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
  inspectElementTool,
  highlightTextTool
]