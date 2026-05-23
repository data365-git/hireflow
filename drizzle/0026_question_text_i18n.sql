-- MANUAL REVIEW REQUIRED before running this migration.
-- After running, update schema.ts: questionTemplateItems.text type from text() to jsonb().$type<{uz:string;ru:string;en:string}>()
-- After schema.ts update, update the question editor UI and bot handler to use text.uz / text.ru / text.en

-- Migrate question_template_items.text from plain text to jsonb {uz, ru, en}
-- Step 1: Add temp column
ALTER TABLE question_template_items ADD COLUMN IF NOT EXISTS text_i18n jsonb;

-- Step 2: Backfill — assume existing text is Uzbek; mirror to ru and en as placeholder
UPDATE question_template_items
SET text_i18n = jsonb_build_object('uz', text, 'ru', text, 'en', text)
WHERE text_i18n IS NULL;

-- Step 3: Swap columns
ALTER TABLE question_template_items DROP COLUMN text;
ALTER TABLE question_template_items RENAME COLUMN text_i18n TO text;
ALTER TABLE question_template_items ALTER COLUMN text SET NOT NULL;

-- Same for screening_questions on vacancy_stages (if that table exists)
-- Check first: if screening_questions table has a text column, apply same pattern
-- (Leave commented out — confirm table name before running)
-- ALTER TABLE screening_questions ADD COLUMN IF NOT EXISTS text_i18n jsonb;
-- UPDATE screening_questions SET text_i18n = jsonb_build_object('uz', text, 'ru', text, 'en', text) WHERE text_i18n IS NULL;
-- ALTER TABLE screening_questions DROP COLUMN text;
-- ALTER TABLE screening_questions RENAME COLUMN text_i18n TO text;
-- ALTER TABLE screening_questions ALTER COLUMN text SET NOT NULL;
