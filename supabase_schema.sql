# ================================================================
# Supabase SQL — Run in Supabase SQL Editor to create all tables
# ================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0. Users table (authentication)
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        TEXT NOT NULL,
  email            TEXT UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  avatar_url       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Insert default admin account (password: admin123)
-- Hash generated with bcrypt, 10 rounds
-- CHANGE THIS PASSWORD after first login!
INSERT INTO users (full_name, email, password_hash, role)
VALUES ('Administrator', 'admin@acadrepo.com', '$2b$10$8K1p/a./dciS6rv0JB/XOeYq3b1g0mhV1oGh6Xl5XjK1Z9ZQz1qK6', 'admin')
ON CONFLICT (email) DO NOTHING;

-- 1. Documents table
CREATE TABLE IF NOT EXISTS documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  extracted_text   TEXT,
  thumbnail_url    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Paragraphs table
CREATE TABLE IF NOT EXISTS paragraphs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  paragraph_text   TEXT NOT NULL,
  paragraph_index  INTEGER NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Plagiarism Results table
CREATE TABLE IF NOT EXISTS plagiarism_results (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id          UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  matched_document_id  UUID REFERENCES documents(id) ON DELETE SET NULL,
  similarity_score     FLOAT NOT NULL,
  matched_paragraph    TEXT,
  source               TEXT NOT NULL CHECK (source IN ('local', 'openai')),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_paragraphs_document_id       ON paragraphs(document_id);
CREATE INDEX IF NOT EXISTS idx_plagiarism_results_document  ON plagiarism_results(document_id);
CREATE INDEX IF NOT EXISTS idx_plagiarism_results_source    ON plagiarism_results(source);
CREATE INDEX IF NOT EXISTS idx_documents_title              ON documents USING gin(to_tsvector('english', title));
