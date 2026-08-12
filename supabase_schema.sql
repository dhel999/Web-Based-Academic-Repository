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
  authors          TEXT,
  course           TEXT,
  year             TEXT,
  abstract         TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Add metadata columns if table already exists
ALTER TABLE documents ADD COLUMN IF NOT EXISTS authors TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS course TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS year TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS abstract TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_content_hash
  ON documents (user_id, content_hash)
  WHERE content_hash IS NOT NULL;

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

-- 4. System Settings table (singleton row id=1)
CREATE TABLE IF NOT EXISTS system_settings (
  id                                    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  max_uploads_per_user                  INTEGER NOT NULL DEFAULT 0,   -- 0 = unlimited
  max_ai_scans_per_user                 INTEGER NOT NULL DEFAULT 0,   -- 0 = unlimited
  max_document_detections_per_student   INTEGER NOT NULL DEFAULT 3,
  ai_scanning_enabled                   BOOLEAN NOT NULL DEFAULT TRUE,
  max_file_size_mb                      INTEGER NOT NULL DEFAULT 20,
  allow_pdf                             BOOLEAN NOT NULL DEFAULT TRUE,
  allow_docx                            BOOLEAN NOT NULL DEFAULT TRUE,
  allow_txt                             BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at                            TIMESTAMPTZ DEFAULT NOW()
);
-- Insert default settings row
INSERT INTO system_settings (id, max_document_detections_per_student)
VALUES (1, 3)
ON CONFLICT (id) DO UPDATE SET max_document_detections_per_student = EXCLUDED.max_document_detections_per_student;

CREATE TABLE IF NOT EXISTS student_detection_usage (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL,
  used_count       INTEGER NOT NULL DEFAULT 0,
  maximum_allowed  INTEGER NOT NULL DEFAULT 3,
  remaining_count  INTEGER NOT NULL DEFAULT 3,
  period           TEXT NOT NULL DEFAULT 'lifetime',
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, period)
);

CREATE TABLE IF NOT EXISTS document_detection_cache (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL,
  document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  document_hash    TEXT NOT NULL,
  ai_score         FLOAT,
  similarity_score FLOAT,
  detection_status TEXT NOT NULL DEFAULT 'processing' CHECK (detection_status IN ('pending','processing','completed','failed')),
  api_provider     TEXT,
  result_data      JSONB,
  detected_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, document_id, document_hash)
);

CREATE INDEX IF NOT EXISTS idx_detection_cache_student_doc ON document_detection_cache(student_id, document_id, document_hash);
CREATE INDEX IF NOT EXISTS idx_detection_cache_status ON document_detection_cache(detection_status);
CREATE INDEX IF NOT EXISTS idx_student_detection_usage_student ON student_detection_usage(student_id);

-- 5. AI Scan Log table (tracks per-user AI scan usage)
CREATE TABLE IF NOT EXISTS ai_scan_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_scan_log_user_id ON ai_scan_log(user_id);
