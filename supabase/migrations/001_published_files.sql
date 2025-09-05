-- Create published_files table for tracking which files are publicly accessible
CREATE TABLE IF NOT EXISTS published_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  blob_url TEXT NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unpublished_at TIMESTAMP WITH TIME ZONE,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique file paths per tenant
  UNIQUE(tenant_id, file_path)
);

-- Create index for faster lookups
CREATE INDEX idx_published_files_tenant_path ON published_files(tenant_id, file_path);
CREATE INDEX idx_published_files_is_published ON published_files(is_published);

-- Add RLS policies (even though we use service key, good practice)
ALTER TABLE published_files ENABLE ROW LEVEL SECURITY;

-- Policy for reading published files (public access)
CREATE POLICY "Public files are viewable by everyone" ON published_files
  FOR SELECT
  USING (is_published = true);

-- Note: Since we use service key with tenant filtering, 
-- we don't need complex RLS policies for write operations