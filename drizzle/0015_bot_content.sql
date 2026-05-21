-- 0015: bot_content table for editable bot messages (About Us / Contact Us)
CREATE TABLE IF NOT EXISTS bot_content (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  language TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT bot_content_key_lang_uniq UNIQUE (key, language)
);
