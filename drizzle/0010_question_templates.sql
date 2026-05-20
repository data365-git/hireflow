CREATE TABLE IF NOT EXISTS question_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS question_template_items (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES question_templates(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type TEXT NOT NULL,
  options JSONB,
  order_index INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS qti_template_idx ON question_template_items(template_id, order_index);
