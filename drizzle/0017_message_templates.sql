CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_templates_kind_idx ON message_templates(kind);
CREATE INDEX IF NOT EXISTS message_templates_owner_idx ON message_templates(owner_id);
