-- 0016: candidate feedback kind for bot complaints and suggestions
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS candidate_id TEXT REFERENCES candidates(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS feedback_candidate_idx ON feedback(candidate_id);
