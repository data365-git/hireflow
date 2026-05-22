-- 0019: recover rows hidden by the old re-running 0004 demo backfill.
-- Telegram bot data and admin-created data must be visible in Live mode.
UPDATE vacancies SET is_demo = false;
UPDATE candidates SET is_demo = false;
