-- Create PageBuilder schema for chat persistence
CREATE SCHEMA IF NOT EXISTS pagebuilder;

-- Chat sessions table (stores conversation sessions)
CREATE TABLE IF NOT EXISTS pagebuilder.chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    folder_path TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Chat messages table (stores individual messages)
CREATE TABLE IF NOT EXISTS pagebuilder.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tools_used JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES pagebuilder.chat_sessions(id) ON DELETE CASCADE
);

-- Chat context table (stores summarized context for long conversations)
CREATE TABLE IF NOT EXISTS pagebuilder.chat_context (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL,
    context_type TEXT NOT NULL CHECK (context_type IN ('summary', 'key_points', 'file_changes')),
    content TEXT NOT NULL,
    relevance_score FLOAT DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES pagebuilder.chat_sessions(id) ON DELETE CASCADE
);

-- File operations history (tracks what files were created/modified)
CREATE TABLE IF NOT EXISTS pagebuilder.file_operations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL,
    message_id UUID NOT NULL,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('create', 'edit', 'delete', 'rename', 'move')),
    file_path TEXT NOT NULL,
    file_content TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES pagebuilder.chat_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_message FOREIGN KEY (message_id) REFERENCES pagebuilder.chat_messages(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_chat_sessions_tenant_user ON pagebuilder.chat_sessions(tenant_id, user_id);
CREATE INDEX idx_chat_sessions_folder ON pagebuilder.chat_sessions(folder_path);
CREATE INDEX idx_chat_messages_session ON pagebuilder.chat_messages(session_id);
CREATE INDEX idx_chat_messages_created ON pagebuilder.chat_messages(created_at DESC);
CREATE INDEX idx_chat_context_session ON pagebuilder.chat_context(session_id);
CREATE INDEX idx_file_operations_session ON pagebuilder.file_operations(session_id);

-- Enable Row Level Security
ALTER TABLE pagebuilder.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagebuilder.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagebuilder.chat_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagebuilder.file_operations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_sessions
CREATE POLICY "Users can view their own sessions" ON pagebuilder.chat_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions" ON pagebuilder.chat_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON pagebuilder.chat_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages from their sessions" ON pagebuilder.chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pagebuilder.chat_sessions 
            WHERE chat_sessions.id = chat_messages.session_id 
            AND chat_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create messages in their sessions" ON pagebuilder.chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM pagebuilder.chat_sessions 
            WHERE chat_sessions.id = chat_messages.session_id 
            AND chat_sessions.user_id = auth.uid()
        )
    );

-- RLS Policies for chat_context
CREATE POLICY "Users can view context from their sessions" ON pagebuilder.chat_context
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pagebuilder.chat_sessions 
            WHERE chat_sessions.id = chat_context.session_id 
            AND chat_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create context in their sessions" ON pagebuilder.chat_context
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM pagebuilder.chat_sessions 
            WHERE chat_sessions.id = chat_context.session_id 
            AND chat_sessions.user_id = auth.uid()
        )
    );

-- RLS Policies for file_operations
CREATE POLICY "Users can view file operations from their sessions" ON pagebuilder.file_operations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pagebuilder.chat_sessions 
            WHERE chat_sessions.id = file_operations.session_id 
            AND chat_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create file operations in their sessions" ON pagebuilder.file_operations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM pagebuilder.chat_sessions 
            WHERE chat_sessions.id = file_operations.session_id 
            AND chat_sessions.user_id = auth.uid()
        )
    );

-- Function to get recent chat context for a session
CREATE OR REPLACE FUNCTION pagebuilder.get_chat_context(p_session_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    message_id UUID,
    role TEXT,
    content TEXT,
    tools_used JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cm.id,
        cm.role,
        cm.content,
        cm.tools_used,
        cm.created_at
    FROM pagebuilder.chat_messages cm
    WHERE cm.session_id = p_session_id
    ORDER BY cm.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to summarize old messages
CREATE OR REPLACE FUNCTION pagebuilder.summarize_old_messages(p_session_id UUID, p_days_old INTEGER DEFAULT 7)
RETURNS VOID AS $$
DECLARE
    v_summary TEXT;
    v_message_count INTEGER;
BEGIN
    -- Count messages older than p_days_old
    SELECT COUNT(*) INTO v_message_count
    FROM pagebuilder.chat_messages
    WHERE session_id = p_session_id
    AND created_at < NOW() - INTERVAL '1 day' * p_days_old;
    
    IF v_message_count > 0 THEN
        -- Create a summary (this would ideally call an AI service)
        v_summary := 'Summary of ' || v_message_count || ' older messages';
        
        -- Store the summary
        INSERT INTO pagebuilder.chat_context (session_id, context_type, content)
        VALUES (p_session_id, 'summary', v_summary);
        
        -- Optionally delete old messages to save space
        -- DELETE FROM pagebuilder.chat_messages
        -- WHERE session_id = p_session_id
        -- AND created_at < NOW() - INTERVAL '1 day' * p_days_old;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;