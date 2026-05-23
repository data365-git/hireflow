ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS vacancy_id text REFERENCES vacancies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS audit_logs_vacancy_idx ON audit_logs (vacancy_id, created_at DESC);
