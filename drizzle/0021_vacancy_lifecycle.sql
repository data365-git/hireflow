ALTER TABLE vacancies
  ADD COLUMN IF NOT EXISTS last_activated_at timestamptz;

UPDATE vacancies
SET last_activated_at = COALESCE(last_activated_at, created_at::timestamptz, now())
WHERE last_activated_at IS NULL;

ALTER TABLE vacancies
  ALTER COLUMN last_activated_at SET DEFAULT now(),
  ALTER COLUMN last_activated_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS vacancy_status_changes (
  id text PRIMARY KEY,
  vacancy_id text NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by text REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vacancy_status_changes_vacancy_changed_at_idx
  ON vacancy_status_changes (vacancy_id, changed_at);
