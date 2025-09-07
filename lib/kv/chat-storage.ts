import { kv } from '@vercel/kv'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  tools?: any[]
}

export interface PageOperation {
  id: string
  type: 'create' | 'update' | 'delete'
  target: string
  changes: any
  timestamp: Date
  revertible: boolean
}

export class ChatStorage {
  private static TTL = 86400 * 30 // 30 days in seconds

  // Get chat key for a specific page
  static getChatKey(tenantId: string, pageId: string): string {
    return `chat:${tenantId}:${pageId}`
  }

  // Get operations key for a specific page
  static getOperationsKey(tenantId: string, pageId: string): string {
    return `ops:${tenantId}:${pageId}`
  }

  // Save chat messages
  static async saveMessages(
    tenantId: string,
    pageId: string,
    messages: ChatMessage[]
  ): Promise<void> {
    const key = this.getChatKey(tenantId, pageId)
    await kv.set(key, messages, { ex: this.TTL })
  }

  // Get chat messages
  static async getMessages(
    tenantId: string,
    pageId: string
  ): Promise<ChatMessage[]> {
    const key = this.getChatKey(tenantId, pageId)
    const messages = await kv.get<ChatMessage[]>(key)
    return messages || []
  }

  // Add a single message
  static async addMessage(
    tenantId: string,
    pageId: string,
    message: ChatMessage
  ): Promise<void> {
    const messages = await this.getMessages(tenantId, pageId)
    messages.push(message)
    await this.saveMessages(tenantId, pageId, messages)
  }

  // Save operations
  static async saveOperations(
    tenantId: string,
    pageId: string,
    operations: PageOperation[]
  ): Promise<void> {
    const key = this.getOperationsKey(tenantId, pageId)
    await kv.set(key, operations, { ex: this.TTL })
  }

  // Get operations
  static async getOperations(
    tenantId: string,
    pageId: string
  ): Promise<PageOperation[]> {
    const key = this.getOperationsKey(tenantId, pageId)
    const operations = await kv.get<PageOperation[]>(key)
    return operations || []
  }

  // Add a single operation
  static async addOperation(
    tenantId: string,
    pageId: string,
    operation: PageOperation
  ): Promise<void> {
    const operations = await this.getOperations(tenantId, pageId)
    operations.push(operation)
    await this.saveOperations(tenantId, pageId, operations)
  }

  // Clear chat for a page
  static async clearChat(tenantId: string, pageId: string): Promise<void> {
    const key = this.getChatKey(tenantId, pageId)
    await kv.del(key)
  }

  // Clear operations for a page
  static async clearOperations(tenantId: string, pageId: string): Promise<void> {
    const key = this.getOperationsKey(tenantId, pageId)
    await kv.del(key)
  }
}

// For local development without KV, use in-memory storage
export class InMemoryChatStorage {
  private static storage = new Map<string, any>()

  static async saveMessages(
    tenantId: string,
    pageId: string,
    messages: ChatMessage[]
  ): Promise<void> {
    const key = `chat:${tenantId}:${pageId}`
    this.storage.set(key, messages)
  }

  static async getMessages(
    tenantId: string,
    pageId: string
  ): Promise<ChatMessage[]> {
    const key = `chat:${tenantId}:${pageId}`
    return this.storage.get(key) || []
  }

  static async addMessage(
    tenantId: string,
    pageId: string,
    message: ChatMessage
  ): Promise<void> {
    const messages = await this.getMessages(tenantId, pageId)
    messages.push(message)
    await this.saveMessages(tenantId, pageId, messages)
  }

  static async saveOperations(
    tenantId: string,
    pageId: string,
    operations: PageOperation[]
  ): Promise<void> {
    const key = `ops:${tenantId}:${pageId}`
    this.storage.set(key, operations)
  }

  static async getOperations(
    tenantId: string,
    pageId: string
  ): Promise<PageOperation[]> {
    const key = `ops:${tenantId}:${pageId}`
    return this.storage.get(key) || []
  }

  static async addOperation(
    tenantId: string,
    pageId: string,
    operation: PageOperation
  ): Promise<void> {
    const operations = await this.getOperations(tenantId, pageId)
    operations.push(operation)
    await this.saveOperations(tenantId, pageId, operations)
  }

  static async clearChat(tenantId: string, pageId: string): Promise<void> {
    const key = `chat:${tenantId}:${pageId}`
    this.storage.delete(key)
  }

  static async clearOperations(tenantId: string, pageId: string): Promise<void> {
    const key = `ops:${tenantId}:${pageId}`
    this.storage.delete(key)
  }
}

// Export the appropriate storage based on environment
export const Storage = process.env.KV_REST_API_URL 
  ? ChatStorage 
  : InMemoryChatStorage