import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET(request: NextRequest) {
  try {
    // Test connection by listing tables
    const { data: tables, error: tablesError } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)
    
    if (tablesError) {
      // Try another table if tenants doesn't exist
      const { data: customDomains, error: domainsError } = await supabase
        .from('custom_domains')
        .select('id')
        .limit(1)
      
      if (domainsError) {
        return NextResponse.json({
          success: false,
          message: 'Supabase connected but tables not accessible',
          errors: {
            tenants: tablesError.message,
            custom_domains: domainsError.message
          }
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Supabase connection successful',
      connection: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
      }
    })
  } catch (error) {
    console.error('Supabase test error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to Supabase', details: error },
      { status: 500 }
    )
  }
}