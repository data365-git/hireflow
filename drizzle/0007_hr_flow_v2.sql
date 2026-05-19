-- HR flow v2 additive schema.
-- New tables do not carry is_demo; mode scoping flows through parent
-- candidates/applications/vacancies.

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO departments (id, name, display_name) VALUES
  ('dept_engineering', 'engineering', 'Engineering'),
  ('dept_marketing', 'marketing', 'Marketing'),
  ('dept_sales', 'sales', 'Sales'),
  ('dept_operations', 'operations', 'Operations'),
  ('dept_design', 'design', 'Design')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS marital_status TEXT,
  ADD COLUMN IF NOT EXISTS is_student BOOLEAN,
  ADD COLUMN IF NOT EXISTS education_field TEXT,
  ADD COLUMN IF NOT EXISTS english_level TEXT,
  ADD COLUMN IF NOT EXISTS russian_level TEXT,
  ADD COLUMN IF NOT EXISTS work_experience JSONB,
  ADD COLUMN IF NOT EXISTS department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS language_pref TEXT;

ALTER TABLE vacancy_stages
  ADD COLUMN IF NOT EXISTS is_reserve BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE timeline_events
  ADD COLUMN IF NOT EXISTS comment TEXT;

ALTER TABLE stage_template_stages
  ADD COLUMN IF NOT EXISTS is_reserve BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS application_watches (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  watcher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS application_watches_application_watcher_uniq
  ON application_watches(application_id, watcher_id);

CREATE INDEX IF NOT EXISTS application_watches_application_idx
  ON application_watches(application_id);

CREATE INDEX IF NOT EXISTS application_watches_watcher_idx
  ON application_watches(watcher_id);

CREATE TABLE IF NOT EXISTS candidate_relationships (
  id TEXT PRIMARY KEY,
  candidate_a_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  candidate_b_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  note TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (candidate_a_id <> candidate_b_id)
);

CREATE INDEX IF NOT EXISTS candidate_relationships_candidate_a_idx
  ON candidate_relationships(candidate_a_id);

CREATE INDEX IF NOT EXISTS candidate_relationships_candidate_b_idx
  ON candidate_relationships(candidate_b_id);

CREATE TABLE IF NOT EXISTS candidate_blacklist (
  candidate_id TEXT PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  added_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  application_id TEXT REFERENCES applications(id) ON DELETE CASCADE,
  vacancy_id TEXT REFERENCES vacancies(id) ON DELETE SET NULL,
  rating INTEGER,
  comment TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_application_idx
  ON feedback(application_id);

CREATE INDEX IF NOT EXISTS feedback_vacancy_idx
  ON feedback(vacancy_id);
