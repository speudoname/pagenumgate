import { SupabaseClientFactory, initializeSupabase } from './shared-client-factory'

// Initialize the shared Supabase client factory
initializeSupabase()

// Export pre-configured client for backward compatibility
export function createClient() {
  return SupabaseClientFactory.createAdminClient()
}

// Export the factory for advanced use cases
export { SupabaseClientFactory }