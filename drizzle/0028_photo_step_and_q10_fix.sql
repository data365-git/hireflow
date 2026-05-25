-- Fix: remove duplicate portfolio question from Video Editor template
-- The bot already collects portfolio links in the dedicated awaiting_portfolio state.
-- Q10 asked for the same thing, causing candidates to be prompted twice.
DELETE FROM question_template_items WHERE id = 'qt-video-editor-full-q10';

-- Add application photo column (captured between portfolio and motivation steps)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS application_photo_file_id text;
