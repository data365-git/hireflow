ALTER TABLE vacancies ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
-- Do not backfill here. This migration is executed by the production startup
-- runner, so data-changing statements would re-run on every deploy and hide
-- live data by re-flagging it as demo.
