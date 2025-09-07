'use client'

import { useState, useEffect } from 'react'
import { getApiUrl } from '@/lib/utils/api'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      // Get user info
      const userResponse = await fetch(getApiUrl('/api/auth/me'))
      if (userResponse.ok) {
        const userData = await userResponse.json()
        setUser(userData)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Access Denied</p>
          <p className="text-gray-600">Only administrators can access settings</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b-2 border-black">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-sm text-gray-600">Configure AI Assistant</p>
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-white hover:bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              Back to Page Builder
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">AI Configuration</h2>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 font-medium">🤖 AI Assistant Status</p>
            <p className="text-sm text-blue-700 mt-1">
              The AI assistant is configured via environment variables and is ready to help you create and manage files.
            </p>
            <p className="text-xs text-blue-600 mt-2">
              API key management is handled at the server level for security.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">About AI Assistant</h2>
          <div className="prose prose-sm text-gray-600">
            <p>
              The AI Assistant uses Claude Opus 4.1 to help you manage files and folders
              in your workspace. It can:
            </p>
            <ul>
              <li>Create, edit, and delete files</li>
              <li>Organize folder structures</li>
              <li>Generate HTML, CSS, and JavaScript code</li>
              <li>Help with content creation</li>
              <li>Answer questions about your files</li>
            </ul>
            <p className="mt-4">
              Chat histories are saved per context (folder or file) so you can continue
              conversations where you left off.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}