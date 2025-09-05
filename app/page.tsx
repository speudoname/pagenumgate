'use client'

import { useEffect, useState } from 'react'
import { verifyToken } from '@/lib/auth/jwt'

interface UserInfo {
  tenant_id: string
  user_id: string
  email: string
  role: string
}

export default function PageBuilderDashboard() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      try {
        // With basePath, API routes are automatically prefixed
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const userData = await response.json()
          setUser(userData)
        }
      } catch (error) {
        console.error('Failed to load user:', error)
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [])

  const handleBackToGateway = () => {
    // Navigate back to gateway dashboard
    window.location.href = '/dashboard'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Authentication failed</p>
          <button
            onClick={handleBackToGateway}
            className="px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-yellow-400 hover:bg-yellow-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
          >
            Back to Gateway
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b-2 border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold">Page Builder</h1>
              <p className="text-sm text-gray-600">NumGate Platform</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <button
                onClick={handleBackToGateway}
                className="px-4 py-2 border-2 border-black text-sm font-medium rounded-md bg-white hover:bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                Back to Gateway
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        <div className="bg-green-50 border-2 border-green-400 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-green-900 mb-2">
            ✅ Cross-App Authentication Successful!
          </h2>
          <p className="text-green-800">
            You have successfully navigated from the Gateway to the Page Builder app.
          </p>
          <div className="mt-4 p-4 bg-white rounded border border-green-300">
            <p className="text-sm font-mono">
              <strong>Tenant ID:</strong> {user.tenant_id}<br/>
              <strong>User ID:</strong> {user.user_id}<br/>
              <strong>Email:</strong> {user.email}<br/>
              <strong>Role:</strong> {user.role}
            </p>
          </div>
        </div>

        {/* Page Builder Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="text-2xl mb-2">📄</div>
            <h3 className="text-lg font-bold mb-1">Pages</h3>
            <p className="text-gray-600 text-sm mb-4">Create and manage landing pages</p>
            <button className="text-sm text-blue-600 font-medium">Coming Soon →</button>
          </div>

          <div className="bg-white p-6 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="text-2xl mb-2">🎨</div>
            <h3 className="text-lg font-bold mb-1">Templates</h3>
            <p className="text-gray-600 text-sm mb-4">Choose from pre-built templates</p>
            <button className="text-sm text-blue-600 font-medium">Coming Soon →</button>
          </div>

          <div className="bg-white p-6 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="text-2xl mb-2">🚀</div>
            <h3 className="text-lg font-bold mb-1">Deploy</h3>
            <p className="text-gray-600 text-sm mb-4">Publish to custom domains</p>
            <button className="text-sm text-blue-600 font-medium">Coming Soon →</button>
          </div>
        </div>

        {/* Technical Details */}
        <div className="bg-gray-100 rounded-lg p-6">
          <h3 className="font-bold mb-2">🔐 Authentication Details</h3>
          <ul className="text-sm space-y-1 text-gray-700">
            <li>• JWT token successfully transferred from Gateway</li>
            <li>• Token validated using shared JWT secret</li>
            <li>• Tenant context preserved across apps</li>
            <li>• Ready for multi-tenant operations</li>
          </ul>
        </div>
      </main>
    </div>
  )
}