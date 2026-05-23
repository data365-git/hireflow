CREATE TABLE IF NOT EXISTS bot_test_users (
  id text PRIMARY KEY,
  telegram_user_id text,
  telegram_username text,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  added_by text REFERENCES users(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bot_test_users_has_identifier
    CHECK (telegram_user_id IS NOT NULL OR telegram_username IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS bot_test_users_tg_id_idx ON bot_test_users (telegram_user_id) WHERE telegram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bot_test_users_tg_username_idx ON bot_test_users (lower(telegram_username)) WHERE telegram_username IS NOT NULL;
CREATE INDEX IF NOT EXISTS bot_test_users_active_idx ON bot_test_users (is_active, expires_at);
