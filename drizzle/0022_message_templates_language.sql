ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'uz';

UPDATE message_templates
SET language = 'ru'
WHERE language = 'uz'
  AND (
    id ILIKE '%-ru-%'
    OR name ILIKE '% RU'
    OR name ILIKE '% RU %'
    OR RIGHT(name, 2) = 'RU'
  );

UPDATE message_templates
SET language = 'en'
WHERE language = 'uz'
  AND (
    id ILIKE '%-en-%'
    OR name ILIKE '% EN'
    OR name ILIKE '% EN %'
    OR RIGHT(name, 2) = 'EN'
  );

CREATE INDEX IF NOT EXISTS message_templates_language_idx ON message_templates(language);
