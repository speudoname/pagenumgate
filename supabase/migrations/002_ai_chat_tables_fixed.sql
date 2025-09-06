-- Helper functions for RLS (if they don't already exist)
CREATE OR REPLACE FUNCTION get_auth_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN current_setting('request.headers', true)::json->>'x-tenant-id';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_auth_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN current_setting('request.headers', true)::json->>'x-user-id';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('request.headers', true)::json->>'x-user-role' IN ('admin', 'owner');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- AI Chat Sessions Table
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  context_type VARCHAR(20) NOT NULL CHECK (context_type IN ('folder', 'file', 'global')),
  context_path TEXT NOT NULL, -- The file or folder path
  title TEXT, -- Optional title for the session
  model VARCHAR(50) DEFAULT 'claude-sonnet-4',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Chat Messages Table
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tools_called JSONB, -- Array of tool calls made
  tool_results JSONB, -- Results from tool executions
  tokens_used INTEGER,
  model_used VARCHAR(50), -- Track which model was used for this message
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI API Keys Table (encrypted)
CREATE TABLE IF NOT EXISTS ai_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  encrypted_key TEXT NOT NULL, -- Will be encrypted before storage
  provider VARCHAR(50) DEFAULT 'anthropic',
  usage_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Tool Executions Log (for audit)
CREATE TABLE IF NOT EXISTS ai_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES ai_chat_messages(id) ON DELETE CASCADE,
  tool_name VARCHAR(100) NOT NULL,
  tool_input JSONB NOT NULL,
  tool_output JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Model Preferences Table
CREATE TABLE IF NOT EXISTS ai_model_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  default_model VARCHAR(50) DEFAULT 'claude-sonnet-4',
  available_models JSONB DEFAULT '["claude-sonnet-4", "claude-opus-4-1"]',
  model_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_sessions_tenant ON ai_chat_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_context ON ai_chat_sessions(context_type, context_path);
CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_tool_executions_session ON ai_tool_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_preferences_tenant ON ai_model_preferences(tenant_id);

-- RLS Policies
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their tenant's AI sessions" ON ai_chat_sessions;
DROP POLICY IF EXISTS "Users can create AI sessions for their tenant" ON ai_chat_sessions;
DROP POLICY IF EXISTS "Users can view messages for their sessions" ON ai_chat_messages;
DROP POLICY IF EXISTS "Admins can manage API keys" ON ai_api_keys;
DROP POLICY IF EXISTS "Users can view tool executions for their sessions" ON ai_tool_executions;

-- Users can only see their own tenant's sessions
CREATE POLICY "Users can view their tenant's AI sessions" ON ai_chat_sessions
  FOR SELECT USING (
    tenant_id::text = (SELECT get_auth_tenant_id()::text)
  );

CREATE POLICY "Users can create AI sessions for their tenant" ON ai_chat_sessions
  FOR INSERT WITH CHECK (
    tenant_id::text = (SELECT get_auth_tenant_id()::text) AND
    user_id::text = (SELECT get_auth_user_id()::text)
  );

-- Users can view messages for their tenant's sessions
CREATE POLICY "Users can view messages for their sessions" ON ai_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_chat_sessions 
      WHERE ai_chat_sessions.id = ai_chat_messages.session_id 
      AND ai_chat_sessions.tenant_id::text = (SELECT get_auth_tenant_id()::text)
    )
  );

-- Only admins can manage API keys
CREATE POLICY "Admins can manage API keys" ON ai_api_keys
  FOR ALL USING (
    tenant_id::text = (SELECT get_auth_tenant_id()::text) AND
    (SELECT user_is_admin())
  );

-- Tool executions follow session permissions
CREATE POLICY "Users can view tool executions for their sessions" ON ai_tool_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_chat_sessions 
      WHERE ai_chat_sessions.id = ai_tool_executions.session_id 
      AND ai_chat_sessions.tenant_id::text = (SELECT get_auth_tenant_id()::text)
    )
  );

-- Model preferences policies
CREATE POLICY "Users can view their tenant's model preferences" ON ai_model_preferences
  FOR SELECT USING (
    tenant_id::text = (SELECT get_auth_tenant_id()::text)
  );

CREATE POLICY "Admins can manage model preferences" ON ai_model_preferences
  FOR ALL USING (
    tenant_id::text = (SELECT get_auth_tenant_id()::text) AND
    (SELECT user_is_admin())
  );