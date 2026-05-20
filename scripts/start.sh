#!/bin/bash
set -e
echo "Starting app..."
# Run migrations in the background with a 120s timeout to avoid blocking app startup.
# Railway healthcheck will begin after app is listening, giving migrations time to complete.
(timeout 120 npm run db:migrate || {
  echo "Warning: db:migrate timed out or failed after 120s (table may already exist)"
}) &
npm start
