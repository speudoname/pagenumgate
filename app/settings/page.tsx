'use client'

import { useState, useEffect } from 'react'
import { getApiUrl } from '@/lib/utils/api'

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [keyInfo, setKeyInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
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
        
        // Only load API key info if user is admin
        if (userData.role === 'admin' || userData.role === 'owner') {
          const keyResponse = await fetch(getApiUrl('/api/ai/api-key'))
          if (keyResponse.ok) {
            const keyData = await keyResponse.json()
            setHasKey(keyData.hasKey)
            setKeyInfo(keyData.keyInfo)
          }
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveApiKey = async () => {
    if (!apiKey) return

    setSaving(true)
    setMessage('')

    try {
      const response = await fetch(getApiUrl('/api/ai/api-key'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey })
      })

      if (response.ok) {
        setMessage('API key saved successfully')
        setHasKey(true)
        setApiKey('')
        await loadSettings()
      } else {
        const error = await response.json()
        setMessage(`Error: ${error.error}`)
      }
    } catch (error) {
      setMessage('Failed to save API key')
    } finally {
      setSaving(false)
    }
  }

  const deleteApiKey = async () => {
    if (!confirm('Are you sure you want to delete the API key?')) return

    setSaving(true)
    setMessage('')

    try {
      const response = await fetch(getApiUrl('/api/ai/api-key'), {
        method: 'DELETE'
      })

      if (response.ok) {
        setMessage('API key deleted successfully')
        setHasKey(false)
        setKeyInfo(null)
      } else {
        const error = await response.json()
        setMessage(`Error: ${error.error}`)
      }
    } catch (error) {
      setMessage('Failed to delete API key')
    } finally {
      setSaving(false)
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
          <h2 className="text-xl font-semibold mb-4">Claude API Configuration</h2>
          
          {hasKey ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">✓ API Key Configured</p>
                {keyInfo && (
                  <div className="mt-2 text-sm text-green-700">
                    <p>Provider: {keyInfo.provider}</p>
                    <p>Usage: {keyInfo.usageCount} requests</p>
                    {keyInfo.lastUsedAt && (
                      <p>Last used: {new Date(keyInfo.lastUsedAt).toLocaleString()}</p>
                    )}
                  </div>
                )}
              </div>
              
              <button
                onClick={deleteApiKey}
                disabled={saving}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
              >
                Delete API Key
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 font-medium">⚠ No API Key Configured</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Add your Claude API key to enable AI assistant features
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Claude API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get your API key from{' '}
                  <a 
                    href="https://console.anthropic.com/settings/keys" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    Anthropic Console
                  </a>
                </p>
              </div>
              
              <button
                onClick={saveApiKey}
                disabled={!apiKey || saving}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save API Key'}
              </button>
            </div>
          )}
          
          {message && (
            <div className={`mt-4 p-3 rounded-md ${
              message.includes('Error') 
                ? 'bg-red-50 text-red-800' 
                : 'bg-green-50 text-green-800'
            }`}>
              {message}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">About AI Assistant</h2>
          <div className="prose prose-sm text-gray-600">
            <p>
              The AI Assistant uses Claude Sonnet 4 and Claude Opus 4.1 to help you manage files and folders
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