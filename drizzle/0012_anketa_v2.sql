ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS photo_file_id TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_version TEXT,
  ADD COLUMN IF NOT EXISTS education_institution TEXT,
  ADD COLUMN IF NOT EXISTS study_form TEXT,
  ADD COLUMN IF NOT EXISTS study_year TEXT;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS motivation_letter TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_links JSONB;

-- Note: cv_file_id was already removed from applications in a prior migration; no DEPRECATED comment needed.
