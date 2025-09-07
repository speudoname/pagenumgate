-- Drop all AI-related tables and functions from public schema
-- This cleans up everything to start fresh

-- Drop tables (in correct order due to foreign key constraints)
DROP TABLE IF EXISTS ai_tool_executions CASCADE;
DROP TABLE IF EXISTS ai_chat_messages CASCADE;
DROP TABLE IF EXISTS ai_chat_sessions CASCADE;
DROP TABLE IF EXISTS ai_api_keys CASCADE;
DROP TABLE IF EXISTS ai_model_preferences CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS get_auth_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS get_auth_user_id() CASCADE;
DROP FUNCTION IF EXISTS user_is_admin() CASCADE;

-- Confirm cleanup
DO $$
BEGIN
  RAISE NOTICE 'AI tables and functions have been dropped from public schema';
END $$;