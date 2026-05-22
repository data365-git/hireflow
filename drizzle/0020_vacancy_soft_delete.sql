ALTER TABLE vacancies
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by text REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vacancies_deleted_at_idx ON vacancies (deleted_at);

CREATE TABLE IF NOT EXISTS vacancy_deletion_backups (
  id text PRIMARY KEY,
  vacancy_id text NOT NULL,
  vacancy_title text NOT NULL,
  snapshot jsonb NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by text REFERENCES users(id) ON DELETE SET NULL,
  hard_deleted_at timestamptz,
  restore_expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS vacancy_deletion_backups_vacancy_idx
  ON vacancy_deletion_backups (vacancy_id);

CREATE INDEX IF NOT EXISTS vacancy_deletion_backups_deleted_at_idx
  ON vacancy_deletion_backups (deleted_at);
