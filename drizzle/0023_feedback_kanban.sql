-- 0023: complaints and suggestions Kanban workflow
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS reply_text TEXT,
  ADD COLUMN IF NOT EXISTS reply_link TEXT,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE feedback
SET status = 'new'
WHERE status IS NULL OR status = '';

CREATE INDEX IF NOT EXISTS feedback_status_idx ON feedback(status);
