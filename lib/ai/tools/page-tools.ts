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
 * High-level page building tools
 */

/**
 * Add a complete section to the page
 */
export const addSectionTool: Tool = {
  name: 'add_section',
  description: 'Add pre-built section. Use when user says: "add hero", "create features section", "put testimonials", "need contact form", etc.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'HTML file. SMART DEFAULT: Current context. "this page" = current file.'
      },
      section_type: {
        type: 'string',
        enum: ['hero', 'features', 'testimonials', 'pricing', 'cta', 'footer', 'header', 'contact', 'about', 'gallery'],
        description: 'Section type. SMART EXTRACTION: "landing" → hero, "reviews" → testimonials, "prices" → pricing, "call to action" → cta.'
      },
      position: {
        type: 'string',
        enum: ['start', 'end', 'after-header', 'before-footer'],
        description: 'Where to add. SMART MAPPING: "at top" → start, "at bottom" → end, "after nav" → after-header',
        default: 'end'
      },
      content: {
        type: 'object',
        description: 'Section content. SMART GENERATION: Extract title/subtitle from user request. Generate items if mentioned.',
        properties: {
          title: { type: 'string' },
          subtitle: { type: 'string' },
          description: { type: 'string' },
          buttonText: { type: 'string' },
          buttonLink: { type: 'string' },
          items: { type: 'array' }
        }
      }
    },
    required: ['path', 'section_type']
  }
}

/**
 * Apply a theme or style preset to the page
 */
export const applyThemeTool: Tool = {
  name: 'apply_theme',
  description: 'Apply design theme. Use when user says: "make it modern", "brutal design", "minimalist style", "dark mode", "apply gradient", etc.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'HTML file. SMART DEFAULT: Current context.'
      },
      theme: {
        type: 'string',
        enum: ['modern', 'classic', 'minimal', 'bold', 'neomorphic', 'neo-brutalist', 'gradient', 'dark'],
        description: 'Theme. SMART MAPPING: "brutal" → neo-brutalist, "clean" → minimal, "professional" → modern, "night" → dark, "simple" → minimal.'
      },
      target: {
        type: 'string',
        description: 'Target section or "all". SMART DEFAULT: "all" unless user specifies section.',
        default: 'all'
      }
    },
    required: ['path', 'theme']
  }
}

/**
 * Update page layout structure
 */
export const updateLayoutTool: Tool = {
  name: 'update_layout',
  description: 'Change layout structure. Use when user says: "make it 2 columns", "create grid", "side by side", "stack vertically", etc.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'HTML file. SMART DEFAULT: Current context.'
      },
      selector: {
        type: 'string',
        description: 'Container selector. SMART EXTRACTION: "the features" → ".features-section", "main content" → "main", "the cards" → ".card-container".'
      },
      layout: {
        type: 'string',
        enum: ['single-column', 'two-columns', 'three-columns', 'grid-2x2', 'grid-3x3', 'flex-row', 'flex-column'],
        description: 'Layout. SMART MAPPING: "2 cols" → two-columns, "grid" → grid-2x2, "horizontal" → flex-row, "vertical" → flex-column, "cards" → three-columns.'
      },
      responsive: {
        type: 'boolean',
        description: 'Responsive layout. DEFAULT: true (always responsive unless user says "fixed").',
        default: true
      }
    },
    required: ['path', 'selector', 'layout']
  }
}

/**
 * Optimize page for SEO
 */
export const optimizeSeoTool: Tool = {
  name: 'optimize_seo',
  description: 'Optimize for SEO. Use when user says: "improve SEO", "add meta tags", "optimize for search", "set page title", etc.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'HTML file. SMART DEFAULT: Current context.'
      },
      title: {
        type: 'string',
        description: 'Page title. SMART EXTRACTION: Extract from user request or generate based on content. Include brand/company if mentioned.'
      },
      description: {
        type: 'string',
        description: 'Meta description. SMART GENERATION: Create compelling 150-160 char description from user context or page content.'
      },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'Keywords. SMART EXTRACTION: Extract relevant terms from user request and page topic. Include variations.'
      },
      ogImage: {
        type: 'string',
        description: 'Social media image. SMART DEFAULT: Use if user provides image URL or mentions "social preview".'
      }
    },
    required: ['path']
  }
}

/**
 * Add a pre-built component from the library
 */
export const addComponentTool: Tool = {
  name: 'add_component',
  description: 'Add pre-built component. Use when user says: "add button", "insert card", "create form", "product component", etc.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'HTML file. SMART DEFAULT: Current context.'
      },
      component: {
        type: 'string',
        description: 'Component name. SMART MAPPING: "button" → "button-primary", "card" → "card-product", "form" → "form-contact". Infer from user request.'
      },
      target_selector: {
        type: 'string',
        description: 'Insert location. SMART EXTRACTION: "in the header" → "header", "after hero" → "#hero", "at the end" → "body".'
      },
      position: {
        type: 'string',
        enum: ['before', 'after', 'prepend', 'append'],
        description: 'Position. SMART DEFAULT: "append" unless user says "before", "after", "at start".',
        default: 'append'
      },
      props: {
        type: 'object',
        description: 'Component props. SMART EXTRACTION: Extract text, labels, links from user request. E.g., "button saying Buy Now" → {text: "Buy Now"}.'
      }
    },
    required: ['path', 'component', 'target_selector']
  }
}

/**
 * Generate section HTML based on type and content
 */
function generateSectionHTML(type: string, content: any): string {
  const templates: Record<string, (c: any) => string> = {
    hero: (c) => `
      <section class="hero-section py-20 px-4 text-center bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <div class="max-w-4xl mx-auto">
          <h1 class="text-5xl font-bold mb-4">${c.title || 'Welcome to Our Platform'}</h1>
          <p class="text-xl mb-8">${c.subtitle || 'Build amazing pages with AI assistance'}</p>
          ${c.buttonText ? `<a href="${c.buttonLink || '#'}" class="inline-block px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition">
            ${c.buttonText}
          </a>` : ''}
        </div>
      </section>`,
    
    features: (c) => `
      <section class="features-section py-16 px-4">
        <div class="max-w-6xl mx-auto">
          <h2 class="text-3xl font-bold text-center mb-12">${c.title || 'Features'}</h2>
          <div class="grid md:grid-cols-3 gap-8">
            ${(c.items || [
              { title: 'Fast', description: 'Lightning quick performance' },
              { title: 'Secure', description: 'Enterprise-grade security' },
              { title: 'Scalable', description: 'Grows with your business' }
            ]).map((item: any) => `
              <div class="feature-card p-6 border rounded-lg hover:shadow-lg transition">
                <h3 class="text-xl font-semibold mb-2">${item.title}</h3>
                <p class="text-gray-600">${item.description}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </section>`,
    
    testimonials: (c) => `
      <section class="testimonials-section py-16 px-4 bg-gray-50">
        <div class="max-w-4xl mx-auto">
          <h2 class="text-3xl font-bold text-center mb-12">${c.title || 'What Our Customers Say'}</h2>
          <div class="space-y-8">
            ${(c.items || [
              { name: 'John Doe', role: 'CEO', text: 'Amazing product!' }
            ]).map((item: any) => `
              <div class="testimonial bg-white p-6 rounded-lg shadow">
                <p class="text-lg mb-4">"${item.text}"</p>
                <div class="font-semibold">${item.name}</div>
                <div class="text-gray-600">${item.role}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>`,
    
    cta: (c) => `
      <section class="cta-section py-16 px-4 bg-blue-600 text-white text-center">
        <div class="max-w-2xl mx-auto">
          <h2 class="text-3xl font-bold mb-4">${c.title || 'Ready to Get Started?'}</h2>
          <p class="text-xl mb-8">${c.subtitle || 'Join thousands of satisfied customers'}</p>
          <a href="${c.buttonLink || '#'}" class="inline-block px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition">
            ${c.buttonText || 'Start Now'}
          </a>
        </div>
      </section>`,
    
    contact: (c) => `
      <section class="contact-section py-16 px-4">
        <div class="max-w-2xl mx-auto">
          <h2 class="text-3xl font-bold text-center mb-8">${c.title || 'Contact Us'}</h2>
          <form class="space-y-4">
            <input type="text" placeholder="Name" class="w-full px-4 py-2 border rounded-lg" />
            <input type="email" placeholder="Email" class="w-full px-4 py-2 border rounded-lg" />
            <textarea placeholder="Message" rows="4" class="w-full px-4 py-2 border rounded-lg"></textarea>
            <button type="submit" class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Send Message
            </button>
          </form>
        </div>
      </section>`
  }
  
  return templates[type] ? templates[type](content || {}) : ''
}

/**
 * Apply theme classes to elements
 */
function applyThemeClasses(theme: string): Record<string, string> {
  const themes: Record<string, Record<string, string>> = {
    modern: {
      button: 'px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg shadow-lg hover:shadow-xl transition',
      card: 'bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition',
      section: 'py-20 px-4'
    },
    minimal: {
      button: 'px-4 py-2 border border-black text-black hover:bg-black hover:text-white transition',
      card: 'border border-gray-200 p-4',
      section: 'py-12 px-4'
    },
    'neo-brutalist': {
      button: 'px-6 py-3 bg-yellow-400 text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition',
      card: 'bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6',
      section: 'py-16 px-4'
    },
    dark: {
      button: 'px-6 py-3 bg-gray-800 text-white rounded hover:bg-gray-700 transition',
      card: 'bg-gray-900 text-white rounded-lg p-6',
      section: 'bg-gray-950 text-white py-16 px-4'
    }
  }
  
  return themes[theme] || themes.modern
}

/**
 * Generate responsive layout classes
 */
function generateLayoutClasses(layout: string): string {
  const layouts: Record<string, string> = {
    'single-column': 'flex flex-col',
    'two-columns': 'grid md:grid-cols-2 gap-8',
    'three-columns': 'grid md:grid-cols-3 gap-8',
    'grid-2x2': 'grid grid-cols-2 gap-4',
    'grid-3x3': 'grid grid-cols-3 gap-4',
    'flex-row': 'flex flex-row gap-4 flex-wrap',
    'flex-column': 'flex flex-col gap-4'
  }
  
  return layouts[layout] || layouts['single-column']
}

/**
 * Execute page building tools
 */
export async function executePageTool(
  toolName: string,
  input: any,
  tenantId: string
): Promise<any> {
  const blobPath = `${tenantId}/${input.path}`
  
  try {
    // Get the current HTML content
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
      case 'add_section': {
        const sectionHtml = generateSectionHTML(input.section_type, input.content)
        if (!sectionHtml) {
          throw new Error(`Unknown section type: ${input.section_type}`)
        }
        
        let targetSelector = 'body'
        if (input.position === 'after-header') {
          targetSelector = 'header'
        } else if (input.position === 'before-footer') {
          targetSelector = 'footer'
        }
        
        const position = input.position === 'start' ? 'prepend' : 
                        input.position === 'before-footer' ? 'before' : 'append'
        
        const success = parser.addElement(targetSelector, sectionHtml, position)
        
        if (success) {
          const updatedHtml = parser.getHTML()
          await put(blobPath, updatedHtml, {
            access: 'public',
            contentType: 'text/html',
          })
          
          return {
            success: true,
            message: `Added ${input.section_type} section`,
            section_type: input.section_type,
            position: input.position
          }
        } else {
          throw new Error('Failed to add section')
        }
      }
      
      case 'apply_theme': {
        const themeClasses = applyThemeClasses(input.theme)
        
        // Apply theme to buttons
        const buttons = parser.document.querySelectorAll('button, a.button, .btn')
        buttons.forEach(btn => {
          if (btn instanceof HTMLElement) {
            btn.className = themeClasses.button
          }
        })
        
        // Apply theme to cards
        const cards = parser.document.querySelectorAll('.card, .feature-card, .testimonial')
        cards.forEach(card => {
          if (card instanceof HTMLElement) {
            card.className = card.className.split(' ')[0] + ' ' + themeClasses.card
          }
        })
        
        // Apply theme to sections if targeting all
        if (input.target === 'all') {
          const sections = parser.document.querySelectorAll('section')
          sections.forEach(section => {
            if (section instanceof HTMLElement) {
              section.className = section.className + ' ' + themeClasses.section
            }
          })
        }
        
        const updatedHtml = parser.getHTML()
        await put(blobPath, updatedHtml, {
          access: 'public',
          contentType: 'text/html',
        })
        
        return {
          success: true,
          message: `Applied ${input.theme} theme`,
          theme: input.theme,
          target: input.target
        }
      }
      
      case 'update_layout': {
        const layoutClasses = generateLayoutClasses(input.layout)
        const success = parser.updateElement(input.selector, {
          attributes: {
            class: layoutClasses
          }
        })
        
        if (success) {
          const updatedHtml = parser.getHTML()
          await put(blobPath, updatedHtml, {
            access: 'public',
            contentType: 'text/html',
          })
          
          return {
            success: true,
            message: `Updated layout to ${input.layout}`,
            selector: input.selector,
            layout: input.layout
          }
        } else {
          throw new Error(`Could not find element: ${input.selector}`)
        }
      }
      
      case 'optimize_seo': {
        const head = parser.document.querySelector('head')
        if (!head) {
          throw new Error('No head element found')
        }
        
        // Update or add title
        if (input.title) {
          let titleEl = head.querySelector('title')
          if (!titleEl) {
            titleEl = parser.document.createElement('title')
            head.appendChild(titleEl)
          }
          titleEl.textContent = input.title
        }
        
        // Update or add meta description
        if (input.description) {
          let metaDesc = head.querySelector('meta[name="description"]')
          if (!metaDesc) {
            metaDesc = parser.document.createElement('meta')
            metaDesc.setAttribute('name', 'description')
            head.appendChild(metaDesc)
          }
          metaDesc.setAttribute('content', input.description)
        }
        
        // Add keywords
        if (input.keywords && input.keywords.length > 0) {
          let metaKeywords = head.querySelector('meta[name="keywords"]')
          if (!metaKeywords) {
            metaKeywords = parser.document.createElement('meta')
            metaKeywords.setAttribute('name', 'keywords')
            head.appendChild(metaKeywords)
          }
          metaKeywords.setAttribute('content', input.keywords.join(', '))
        }
        
        // Add Open Graph image
        if (input.ogImage) {
          let ogImage = head.querySelector('meta[property="og:image"]')
          if (!ogImage) {
            ogImage = parser.document.createElement('meta')
            ogImage.setAttribute('property', 'og:image')
            head.appendChild(ogImage)
          }
          ogImage.setAttribute('content', input.ogImage)
        }
        
        const updatedHtml = parser.getHTML()
        await put(blobPath, updatedHtml, {
          access: 'public',
          contentType: 'text/html',
        })
        
        return {
          success: true,
          message: 'SEO optimized',
          updates: {
            title: input.title,
            description: input.description,
            keywords: input.keywords,
            ogImage: input.ogImage
          }
        }
      }
      
      case 'add_component': {
        // For now, use simple component templates
        // In production, these would come from the shared blob storage
        const components: Record<string, string> = {
          'button-primary': '<button class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Click Me</button>',
          'card-product': `<div class="card p-6 border rounded-lg shadow hover:shadow-lg transition">
            <h3 class="text-xl font-semibold mb-2">Product Name</h3>
            <p class="text-gray-600 mb-4">Product description goes here</p>
            <button class="px-4 py-2 bg-blue-600 text-white rounded">Learn More</button>
          </div>`,
          'form-contact': `<form class="space-y-4">
            <input type="text" placeholder="Name" class="w-full px-4 py-2 border rounded" />
            <input type="email" placeholder="Email" class="w-full px-4 py-2 border rounded" />
            <button type="submit" class="w-full px-4 py-2 bg-blue-600 text-white rounded">Submit</button>
          </form>`
        }
        
        let componentHtml = components[input.component]
        if (!componentHtml) {
          throw new Error(`Unknown component: ${input.component}`)
        }
        
        // Apply props if provided
        if (input.props) {
          // Simple prop replacement for demo
          Object.entries(input.props).forEach(([key, value]) => {
            componentHtml = componentHtml.replace(new RegExp(`{{${key}}}`, 'g'), String(value))
          })
        }
        
        const success = parser.addElement(
          input.target_selector,
          componentHtml,
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
            message: `Added component ${input.component}`,
            component: input.component,
            target: input.target_selector
          }
        } else {
          throw new Error(`Could not find target: ${input.target_selector}`)
        }
      }
      
      default:
        throw new Error(`Unknown page tool: ${toolName}`)
    }
  } catch (error) {
    throw error
  }
}

// Export all page tools as an array
export const pageTools = [
  addSectionTool,
  applyThemeTool,
  updateLayoutTool,
  optimizeSeoTool,
  addComponentTool
]