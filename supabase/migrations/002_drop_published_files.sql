-- Drop the published_files table as we're using folder-based publishing now
-- Files in 'unpublished' folders are unpublished, everything else is published

-- Drop indexes first
DROP INDEX IF EXISTS idx_published_files_tenant_path;
DROP INDEX IF EXISTS idx_published_files_is_published;

-- Drop the RLS policy
DROP POLICY IF EXISTS "Public files are viewable by everyone" ON published_files;

-- Drop the table
DROP TABLE IF EXISTS published_files;

-- Clean up: This removes all traces of the database-based publishing system
-- The new system uses folder structure:
-- - Files in any 'unpublished' folder are not accessible publicly
-- - All other files are automatically published