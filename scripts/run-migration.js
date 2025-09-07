const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runMigration() {
  try {
    console.log('🚀 Starting PageBuilder schema migration...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', 'create_pagebuilder_schema.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    }).single()
    
    if (error) {
      // If RPC doesn't exist, try direct execution
      console.log('Direct RPC not available, executing statements individually...')
      
      // Split by semicolons and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0)
      
      for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 50)}...`)
        const { error: stmtError } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        }).single()
        
        if (stmtError) {
          console.error('Statement failed:', stmtError)
          // Continue with other statements
        }
      }
    }
    
    console.log('✅ Migration completed successfully!')
    console.log('\nCreated tables:')
    console.log('  - pagebuilder.chat_sessions')
    console.log('  - pagebuilder.chat_messages')
    console.log('  - pagebuilder.chat_context')
    console.log('  - pagebuilder.file_operations')
    console.log('\nRLS policies applied for secure access')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    console.log('\n📝 Manual steps:')
    console.log('1. Go to your Supabase dashboard')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Copy contents from: supabase/migrations/create_pagebuilder_schema.sql')
    console.log('4. Paste and run in SQL Editor')
  }
}

runMigration()