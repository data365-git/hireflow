-- T0.1: Unique constraint — prevents duplicate (candidate, vacancy) applications under concurrent /start webhooks
-- Note: Postgres does not support IF NOT EXISTS on ADD CONSTRAINT; use DO block instead.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applications_candidate_vacancy_uniq'
  ) THEN
    ALTER TABLE applications
      ADD CONSTRAINT applications_candidate_vacancy_uniq
      UNIQUE (candidate_id, vacancy_id);
  END IF;
END$$;

-- T0.2: Hot indexes — required for 100+ applicant load
CREATE INDEX IF NOT EXISTS applications_vacancy_id_idx        ON applications(vacancy_id);
CREATE INDEX IF NOT EXISTS applications_candidate_vacancy_idx  ON applications(candidate_id, vacancy_id);
CREATE INDEX IF NOT EXISTS applications_source_id_idx          ON applications(source_id);
CREATE INDEX IF NOT EXISTS applications_last_activity_at_idx   ON applications(last_activity_at);
CREATE INDEX IF NOT EXISTS sources_vacancy_id_idx              ON sources(vacancy_id);
CREATE INDEX IF NOT EXISTS vacancy_stages_vacancy_id_idx       ON vacancy_stages(vacancy_id);

-- T0.3: Webhook idempotency table — deduplicates Telegram update retries
CREATE TABLE IF NOT EXISTS received_updates (
  update_id   bigint PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- T0.11: updatedAt column on vacancies — tracks last edit time
ALTER TABLE vacancies
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
