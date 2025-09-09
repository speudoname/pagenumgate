import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Shared utility functions for the Komunate platform
 * These utilities are copied to each app to maintain independence
 */

/**
 * Tailwind CSS class name utility
 * Combines clsx and tailwind-merge for optimal class handling
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * API URL builder for different applications
 * Handles subpath routing for production vs development
 */
export function getApiUrl(path: string, appName?: 'contacts' | 'page-builder'): string {
  // In production, we're served from subpaths
  // This works both when accessed directly and through proxy
  let basePath = ''
  
  if (process.env.NODE_ENV === 'production') {
    if (appName === 'contacts') {
      basePath = '/contacts'
    } else if (appName === 'page-builder') {
      basePath = '/page-builder'
    }
  }
  
  return `${basePath}${path}`
}

/**
 * Simple logger that only logs in development
 * Can be customized per application
 */
export function createLogger(appName: string) {
  const isDev = process.env.NODE_ENV === 'development'
  
  return {
    log: (...args: any[]) => {
      if (isDev) {
        console.log(`[${appName}]`, ...args)
      }
    },
    info: (...args: any[]) => {
      if (isDev) {
        console.info(`[${appName} Info]`, ...args)
      }
    },
    debug: (...args: any[]) => {
      if (isDev) {
        console.debug(`[${appName} Debug]`, ...args)
      }
    },
    error: (...args: any[]) => {
      if (isDev) {
        console.error(`[${appName} Error]`, ...args)
      }
    },
    warn: (...args: any[]) => {
      if (isDev) {
        console.warn(`[${appName} Warning]`, ...args)
      }
    }
  }
}

/**
 * Path building utilities for file operations
 * Handles tenant isolation and path cleaning
 */
export class PathBuilder {
  constructor(private tenantId: string) {}
  
  /**
   * Build a full path with tenant isolation
   */
  buildPath(filename: string, currentFolder: string = ''): string {
    const parts = [this.tenantId]
    
    if (currentFolder && currentFolder !== '/') {
      // Clean the folder path - remove tenant ID if it's duplicated
      let cleanFolder = currentFolder.replace(/^\/+|\/+$/g, '')
      // Remove tenant ID if it's at the beginning of the folder path
      cleanFolder = cleanFolder.replace(new RegExp(`^${this.tenantId}/?`), '')
      if (cleanFolder) {
        parts.push(cleanFolder)
      }
    }
    
    if (filename) {
      // Clean the filename - remove any path parts and tenant ID
      let cleanFilename = filename.replace(/^\/+/, '')
      // If filename contains tenant ID, remove it
      cleanFilename = cleanFilename.replace(new RegExp(`^${this.tenantId}/?`), '')
      // Also remove any folder path from filename if it's already in currentFolder
      if (currentFolder && currentFolder !== '/' && cleanFilename.includes('/')) {
        cleanFilename = cleanFilename.split('/').pop() || cleanFilename
      }
      parts.push(cleanFilename)
    }
    
    return parts.filter(p => p).join('/')
  }
  
  /**
   * Ensure path belongs to tenant (security check)
   */
  ensureTenantPath(path: string): string {
    return path.startsWith(`${this.tenantId}/`) ? path : `${this.tenantId}/${path}`
  }
  
  /**
   * Validate that path belongs to tenant
   */
  validateTenantPath(path: string): boolean {
    return path.startsWith(`${this.tenantId}/`)
  }
  
  /**
   * Generate unique name for duplicates
   */
  generateUniqueName(originalPath: string, type: 'file' | 'folder', counter: number = 1): string {
    const pathParts = originalPath.split('/')
    const fileName = pathParts[pathParts.length - 1]
    
    // Split filename and extension
    const lastDotIndex = fileName.lastIndexOf('.')
    let baseName = fileName
    let extension = ''
    
    if (lastDotIndex > 0 && type === 'file') {
      baseName = fileName.substring(0, lastDotIndex)
      extension = fileName.substring(lastDotIndex)
    }
    
    // Check if it already has a copy suffix
    const copyPattern = / copy( \d+)?$/
    if (copyPattern.test(baseName)) {
      baseName = baseName.replace(copyPattern, '')
    }
    
    // Add copy suffix
    const suffix = counter === 1 ? ' copy' : ` copy ${counter}`
    const newFileName = type === 'file' ? `${baseName}${suffix}${extension}` : `${baseName}${suffix}`
    
    pathParts[pathParts.length - 1] = newFileName
    return pathParts.join('/')
  }
  
  /**
   * Clean file list by removing tenant prefix
   */
  cleanFileList(blobs: any[], currentFolder: string = ''): any[] {
    return blobs.map(blob => {
      const path = blob.pathname
        .replace(this.tenantId + '/', '')
        .replace(currentFolder, '')
        .replace(/^\/+/, '')
      
      return {
        name: path,
        url: blob.url,
        size: blob.size
      }
    })
  }
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Validate URL is from allowed domains
   */
  static validateBlobUrl(url: string, allowedDomains: string[]): boolean {
    try {
      const urlObj = new URL(url)
      return allowedDomains.some(domain => urlObj.hostname.endsWith(domain))
    } catch {
      return false
    }
  }
  
  /**
   * Validate required fields
   */
  static validateRequired(obj: Record<string, any>, fields: string[]): string[] {
    const missing: string[] = []
    fields.forEach(field => {
      if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
        missing.push(field)
      }
    })
    return missing
  }
}
