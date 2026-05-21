ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
-- backfill: all existing rows are demo data
UPDATE vacancies SET is_demo = true;
UPDATE candidates SET is_demo = true;
