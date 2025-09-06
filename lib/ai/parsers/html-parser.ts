import { JSDOM } from 'jsdom'

export interface PageSection {
  selector: string
  type: 'header' | 'section' | 'footer' | 'div' | 'main' | 'article' | 'aside' | 'nav'
  id?: string
  classes?: string[]
  content: string
  innerText?: string
  children: number
}

export class HTMLParser {
  private dom: JSDOM
  public document: Document

  constructor(html: string) {
    this.dom = new JSDOM(html)
    this.document = this.dom.window.document
  }

  /**
   * Get the current HTML string
   */
  getHTML(): string {
    return this.dom.serialize()
  }

  /**
   * Get all major sections in the page
   */
  getSections(): PageSection[] {
    const sections: PageSection[] = []
    const sectionElements = this.document.querySelectorAll('header, main, section, article, aside, nav, footer, div[id], div[class*="section"], div[class*="hero"], div[class*="container"]')
    
    sectionElements.forEach((element, index) => {
      const htmlElement = element as HTMLElement
      sections.push({
        selector: this.generateSelector(htmlElement),
        type: htmlElement.tagName.toLowerCase() as PageSection['type'],
        id: htmlElement.id || undefined,
        classes: htmlElement.className ? htmlElement.className.split(' ').filter(c => c) : undefined,
        content: htmlElement.outerHTML.substring(0, 200) + (htmlElement.outerHTML.length > 200 ? '...' : ''),
        innerText: htmlElement.innerText?.substring(0, 100),
        children: htmlElement.children.length
      })
    })
    
    return sections
  }

  /**
   * Update a specific section by selector
   */
  updateSection(selector: string, newContent: string, preserveAttributes: boolean = true): boolean {
    try {
      const element = this.document.querySelector(selector)
      if (!element) return false

      if (preserveAttributes && element instanceof HTMLElement) {
        // Parse new content to get inner HTML only
        const tempDom = new JSDOM(newContent)
        const newElement = tempDom.window.document.body.firstElementChild
        
        if (newElement) {
          // Preserve original attributes
          const originalAttributes = element.attributes
          
          // Update inner HTML
          element.innerHTML = newElement.innerHTML
          
          // Optionally merge classes
          if (newElement.className) {
            const existingClasses = element.className.split(' ')
            const newClasses = newElement.className.split(' ')
            const mergedClasses = [...new Set([...existingClasses, ...newClasses])]
            element.className = mergedClasses.join(' ')
          }
        } else {
          // If new content is just inner HTML
          element.innerHTML = newContent
        }
      } else {
        // Replace entire element
        const parent = element.parentElement
        if (parent) {
          const tempDiv = this.document.createElement('div')
          tempDiv.innerHTML = newContent
          const newElement = tempDiv.firstElementChild
          if (newElement) {
            parent.replaceChild(newElement, element)
          }
        }
      }
      
      return true
    } catch (error) {
      console.error('Error updating section:', error)
      return false
    }
  }

  /**
   * Find element by text content
   */
  findElementByText(text: string, tagName?: string): string | null {
    const xpath = tagName 
      ? `//${tagName}[contains(text(), "${text}")]`
      : `//*[contains(text(), "${text}")]`
    
    const result = this.document.evaluate(
      xpath,
      this.document,
      null,
      9, // XPathResult.FIRST_ORDERED_NODE_TYPE
      null
    )
    
    if (result.singleNodeValue && result.singleNodeValue instanceof HTMLElement) {
      return this.generateSelector(result.singleNodeValue)
    }
    
    return null
  }

  /**
   * Add element at specific position
   */
  addElement(parentSelector: string, html: string, position: 'before' | 'after' | 'prepend' | 'append' = 'append'): boolean {
    try {
      const parent = this.document.querySelector(parentSelector)
      if (!parent) return false

      const tempDiv = this.document.createElement('div')
      tempDiv.innerHTML = html
      const newElement = tempDiv.firstElementChild
      if (!newElement) return false

      switch (position) {
        case 'before':
          parent.parentElement?.insertBefore(newElement, parent)
          break
        case 'after':
          parent.parentElement?.insertBefore(newElement, parent.nextSibling)
          break
        case 'prepend':
          parent.insertBefore(newElement, parent.firstChild)
          break
        case 'append':
        default:
          parent.appendChild(newElement)
          break
      }
      
      return true
    } catch (error) {
      console.error('Error adding element:', error)
      return false
    }
  }

  /**
   * Remove element by selector
   */
  removeElement(selector: string): boolean {
    try {
      const element = this.document.querySelector(selector)
      if (!element) return false
      
      element.remove()
      return true
    } catch (error) {
      console.error('Error removing element:', error)
      return false
    }
  }

  /**
   * Update element attributes or text
   */
  updateElement(selector: string, updates: { 
    text?: string, 
    html?: string,
    attributes?: Record<string, string>,
    addClass?: string[],
    removeClass?: string[]
  }): boolean {
    try {
      const element = this.document.querySelector(selector)
      if (!element || !(element instanceof HTMLElement)) return false

      if (updates.text !== undefined) {
        element.textContent = updates.text
      }
      
      if (updates.html !== undefined) {
        element.innerHTML = updates.html
      }
      
      if (updates.attributes) {
        Object.entries(updates.attributes).forEach(([key, value]) => {
          element.setAttribute(key, value)
        })
      }
      
      if (updates.addClass) {
        element.classList.add(...updates.addClass)
      }
      
      if (updates.removeClass) {
        element.classList.remove(...updates.removeClass)
      }
      
      return true
    } catch (error) {
      console.error('Error updating element:', error)
      return false
    }
  }

  /**
   * Generate a unique selector for an element
   */
  private generateSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`
    }
    
    const path: string[] = []
    let current: HTMLElement | null = element
    
    while (current && current !== this.document.body) {
      let selector = current.tagName.toLowerCase()
      
      if (current.id) {
        selector = `#${current.id}`
        path.unshift(selector)
        break
      } else if (current.className) {
        const classes = current.className.split(' ').filter(c => c && !c.includes(':'))
        if (classes.length > 0) {
          selector += `.${classes[0]}`
        }
      }
      
      // Add index if there are siblings with same selector
      const parent = current.parentElement
      if (parent) {
        const siblings = Array.from(parent.children).filter(child => 
          child.tagName === current!.tagName && 
          child.className === current!.className
        )
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1
          selector += `:nth-of-type(${index})`
        }
      }
      
      path.unshift(selector)
      current = current.parentElement as HTMLElement | null
    }
    
    return path.join(' > ')
  }

  /**
   * Get element info by selector
   */
  getElementInfo(selector: string): {
    exists: boolean
    tagName?: string
    id?: string
    classes?: string[]
    text?: string
    html?: string
    attributes?: Record<string, string>
  } {
    const element = this.document.querySelector(selector)
    
    if (!element || !(element instanceof HTMLElement)) {
      return { exists: false }
    }
    
    const attributes: Record<string, string> = {}
    Array.from(element.attributes).forEach(attr => {
      attributes[attr.name] = attr.value
    })
    
    return {
      exists: true,
      tagName: element.tagName.toLowerCase(),
      id: element.id || undefined,
      classes: element.className ? element.className.split(' ').filter(c => c) : undefined,
      text: element.textContent || undefined,
      html: element.innerHTML,
      attributes
    }
  }
}