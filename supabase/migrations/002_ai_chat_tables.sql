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
  message_id UUID NOT NULL REFERENCES ai_chat_messages(id) ON DELETE CASCADE,
  tool_name VARCHAR(100) NOT NULL,
  tool_input JSONB NOT NULL,
  tool_output JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_ai_sessions_tenant ON ai_chat_sessions(tenant_id);
CREATE INDEX idx_ai_sessions_user ON ai_chat_sessions(user_id);
CREATE INDEX idx_ai_sessions_context ON ai_chat_sessions(context_type, context_path);
CREATE INDEX idx_ai_messages_session ON ai_chat_messages(session_id);
CREATE INDEX idx_ai_tool_executions_session ON ai_tool_executions(session_id);

-- RLS Policies
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tool_executions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tenant's sessions
CREATE POLICY "Users can view their tenant's AI sessions" ON ai_chat_sessions
  FOR SELECT USING (
    tenant_id = (SELECT get_auth_tenant_id())
  );

CREATE POLICY "Users can create AI sessions for their tenant" ON ai_chat_sessions
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT get_auth_tenant_id()) AND
    user_id = (SELECT get_auth_user_id())
  );

-- Users can view messages for their tenant's sessions
CREATE POLICY "Users can view messages for their sessions" ON ai_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_chat_sessions 
      WHERE ai_chat_sessions.id = ai_chat_messages.session_id 
      AND ai_chat_sessions.tenant_id = (SELECT get_auth_tenant_id())
    )
  );

-- Only admins can manage API keys
CREATE POLICY "Admins can manage API keys" ON ai_api_keys
  FOR ALL USING (
    tenant_id = (SELECT get_auth_tenant_id()) AND
    (SELECT user_is_admin())
  );

-- Tool executions follow session permissions
CREATE POLICY "Users can view tool executions for their sessions" ON ai_tool_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_chat_sessions 
      WHERE ai_chat_sessions.id = ai_tool_executions.session_id 
      AND ai_chat_sessions.tenant_id = (SELECT get_auth_tenant_id())
    )
  );