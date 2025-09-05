// Run this script to create the published_files table in Supabase
// Usage: node scripts/run-migration.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/001_published_files.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute the SQL
    const { error } = await supabase.from('published_files').select('*').limit(1);
    
    if (error && error.message.includes('does not exist')) {
      console.log('Table does not exist, creating...');
      
      // Run the migration via Supabase SQL editor
      console.log('\n📋 Please run this SQL in your Supabase SQL editor:');
      console.log('----------------------------------------');
      console.log(sql);
      console.log('----------------------------------------');
      console.log('\n🔗 Go to: https://supabase.com/dashboard/project/hbopxprpgvrkucztsvnq/sql/new');
      console.log('\n✅ After running the SQL, the published_files table will be ready!');
    } else if (!error) {
      console.log('✅ Table already exists!');
    } else {
      console.error('Error checking table:', error);
    }
  } catch (error) {
    console.error('Migration error:', error);
  }
}

runMigration();