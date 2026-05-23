CREATE TABLE IF NOT EXISTS bot_translations (
  key text NOT NULL,
  language text NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (key, language)
);
CREATE INDEX IF NOT EXISTS bot_translations_key_idx ON bot_translations (key);
