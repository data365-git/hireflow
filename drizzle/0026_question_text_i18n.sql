-- Migrate question_template_items.text from plain text to jsonb {uz, ru, en}
-- Idempotent: guarded by column-type check. Safe to re-run via scripts/run-migrations.ts.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'question_template_items'
      AND column_name = 'text'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE question_template_items ADD COLUMN IF NOT EXISTS text_i18n jsonb;

    UPDATE question_template_items
    SET text_i18n = jsonb_build_object('uz', text, 'ru', text, 'en', text)
    WHERE text_i18n IS NULL;

    ALTER TABLE question_template_items DROP COLUMN text;
    ALTER TABLE question_template_items RENAME COLUMN text_i18n TO text;
    ALTER TABLE question_template_items ALTER COLUMN text SET NOT NULL;
  END IF;
END $$;
