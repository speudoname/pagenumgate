export interface FileNode {
  name: string
  type: 'file' | 'folder'
  path: string
  url?: string
  size?: number
  uploadedAt?: string
  children?: FileNode[]
  isPublished?: boolean
  publicUrl?: string
}

export interface UserInfo {
  tenant_id: string
  user_id: string
  email: string
  role: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  tools?: any[]
}
