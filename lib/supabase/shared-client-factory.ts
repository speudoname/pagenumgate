import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared Supabase client factory that provides consistent client creation
 * across all applications in the Komunate platform
 */
export class SupabaseClientFactory {
  private static supabaseUrl: string
  private static supabaseServiceKey: string
  private static supabaseAnonKey: string

  /**
   * Initialize the factory with environment variables
   * This should be called once at application startup
   */
  static initialize(): void {
    // Get Supabase URL with fallback for PageNumGate compatibility
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hbopxprpgvrkucztsvnq.supabase.co'
    this.supabaseUrl = supabaseUrl

    // Get service key with fallback for PageNumGate compatibility
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    if (!supabaseServiceKey) {
      throw new Error('Missing required environment variable: SUPABASE_SERVICE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    this.supabaseServiceKey = supabaseServiceKey

    // Get anon key (optional for server-side operations)
    this.supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  }

  /**
   * Create an admin client with service role key
   * This bypasses RLS and should only be used in server-side code
   */
  static createAdminClient(): SupabaseClient {
    this.ensureInitialized()
    
    return createClient(this.supabaseUrl, this.supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }) as SupabaseClient
  }

  /**
   * Create a client with service role key for a specific schema
   * Useful for applications that work with specific database schemas
   */
  static createSchemaClient(schema: string): SupabaseClient {
    this.ensureInitialized()
    
    return createClient(this.supabaseUrl, this.supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema
      }
    }) as SupabaseClient
  }

  /**
   * Create a client with anon key for client-side operations
   * This respects RLS policies
   */
  static createAnonClient(): SupabaseClient {
    this.ensureInitialized()
    
    if (!this.supabaseAnonKey) {
      throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    
    return createClient(this.supabaseUrl, this.supabaseAnonKey) as SupabaseClient
  }

  /**
   * Create a client with custom configuration
   * For advanced use cases that need specific settings
   */
  static createCustomClient(
    key: string,
    options?: {
      schema?: string
      auth?: {
        autoRefreshToken?: boolean
        persistSession?: boolean
      }
    }
  ): SupabaseClient {
    this.ensureInitialized()
    
    const config: any = {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        ...options?.auth
      }
    }

    if (options?.schema) {
      config.db = { schema: options.schema }
    }

    return createClient(this.supabaseUrl, key, config) as SupabaseClient
  }

  /**
   * Get the configured Supabase URL
   */
  static getSupabaseUrl(): string {
    this.ensureInitialized()
    return this.supabaseUrl
  }

  /**
   * Check if the factory has been initialized
   */
  private static ensureInitialized(): void {
    if (!this.supabaseUrl || !this.supabaseServiceKey) {
      throw new Error('SupabaseClientFactory not initialized. Call initialize() first.')
    }
  }
}

/**
 * Convenience function to initialize the factory
 * Call this once at application startup
 */
export function initializeSupabaseClientFactory(): void {
  SupabaseClientFactory.initialize()
}

/**
 * Pre-configured clients for common use cases
 * These are created after initialization
 */
export let supabaseAdmin: SupabaseClient
export let supabaseContacts: SupabaseClient
export let supabaseAnon: SupabaseClient

/**
 * Initialize pre-configured clients
 * Call this after SupabaseClientFactory.initialize()
 */
export function initializePreConfiguredClients(): void {
  supabaseAdmin = SupabaseClientFactory.createAdminClient()
  supabaseContacts = SupabaseClientFactory.createSchemaClient('contacts')
  supabaseAnon = SupabaseClientFactory.createAnonClient()
}

/**
 * Complete initialization function that sets up everything
 * Call this once at application startup
 */
export function initializeSupabase(): void {
  initializeSupabaseClientFactory()
  initializePreConfiguredClients()
}
