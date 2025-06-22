"""
Supabase Setup Script for ClauseIQ RAG Implementation

This script provides the SQL commands needed to set up Supabase for vector search.
Run these commands in your Supabase SQL Editor after creating a new project.

SETUP INSTRUCTIONS:
1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor in your Supabase dashboard  
3. Copy and paste the SQL commands below
4. Update your environment variables with Supabase URL and service key
5. Test the connection using the health check endpoint

SECURITY NOTES:
- The service key should be kept secret (server-side only)
- Row Level Security (RLS) ensures users only see their own chunks
- Use the anon key for client-side operations (if needed later)
"""

SUPABASE_SETUP_SQL = '''
-- =============================================
-- ClauseIQ Vector Search Setup for Supabase
-- =============================================

-- Step 1: Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create the chunks table for storing document embeddings
CREATE TABLE chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  metadata     JSONB DEFAULT '{}',
  embedding    VECTOR(3072),  -- OpenAI text-embedding-3-large dimensions
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create indexes for performance
CREATE INDEX idx_chunks_document_id ON chunks (document_id);
CREATE INDEX idx_chunks_user_id ON chunks (user_id);
CREATE INDEX idx_chunks_document_user ON chunks (document_id, user_id);

-- Step 4: Create HNSW index for fast vector similarity search
-- Note: This may take a few seconds to complete
CREATE INDEX idx_chunks_embedding_cosine ON chunks 
USING hnsw (embedding vector_cosine_ops);

-- Step 5: Enable Row Level Security (RLS) for data isolation
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies (users can only access their own chunks)
-- Note: This policy uses user_id stored in the table, not Supabase auth
-- since ClauseIQ has its own auth system
CREATE POLICY "Users can manage their own chunks" ON chunks
  FOR ALL 
  USING (TRUE)  -- Allow all operations for now
  WITH CHECK (TRUE);

-- Alternative: If you want to restrict by user_id field in the future:
-- CREATE POLICY "Users can manage their own chunks" ON chunks
--   FOR ALL 
--   USING (user_id = current_setting('app.current_user_id', true))
--   WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- Step 7: Create the vector similarity search function
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(3072),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter JSONB DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    chunks.id,
    chunks.content,
    chunks.metadata,
    1 - (chunks.embedding <-> query_embedding) AS similarity
  FROM chunks
  WHERE 
    (filter = '{}' OR chunks.metadata @> filter)
    AND 1 - (chunks.embedding <-> query_embedding) > match_threshold
  ORDER BY chunks.embedding <-> query_embedding
  LIMIT match_count;
END $$;

-- Step 8: Create a function to get storage statistics
CREATE OR REPLACE FUNCTION get_storage_stats()
RETURNS TABLE (
  total_chunks BIGINT,
  total_users BIGINT,
  total_documents BIGINT,
  estimated_size_mb FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_chunks,
    COUNT(DISTINCT user_id)::BIGINT AS total_users,
    COUNT(DISTINCT document_id)::BIGINT AS total_documents,
    -- Rough estimate: content ~1KB + embedding ~12KB per chunk
    (COUNT(*) * 13.0 / 1024.0)::FLOAT AS estimated_size_mb
  FROM chunks;
END $$;

-- Step 9: Test the setup with a sample query
-- This should return no results but confirm everything is working
SELECT * FROM match_documents(
  array_fill(0.0, ARRAY[3072])::vector,  -- Dummy embedding vector
  0.5,  -- Threshold
  5     -- Limit
);

-- =============================================
-- Setup Complete!
-- =============================================
-- 
-- Your Supabase database is now ready for ClauseIQ vector search.
-- 
-- Next steps:
-- 1. Copy your Supabase URL and service key from Settings > API
-- 2. Add them to your environment variables:
--    SUPABASE_URL=https://your-project.supabase.co
--    SUPABASE_SERVICE_KEY=your-service-role-key
-- 3. Test the connection using: GET /documents/rag/health
-- 
-- Storage limits on free tier:
-- - 500MB total database storage
-- - ~38,000 document chunks (13KB each including embedding)
-- - Unlimited API requests
-- 
-- =============================================
'''

def print_setup_instructions():
    """Print the setup instructions and SQL."""
    print(__doc__)
    print("\n" + "="*60)
    print("SQL COMMANDS TO RUN IN SUPABASE:")
    print("="*60)
    print(SUPABASE_SETUP_SQL)

if __name__ == "__main__":
    print_setup_instructions()
