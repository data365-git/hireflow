#!/bin/bash
set -e
echo "Starting app..."
# Run ALL migrations (0000–latest) in the background with a 120s timeout.
# scripts/run-migrations.ts applies every drizzle/*.sql file in numeric order.
# drizzle-kit migrate only knows about 0000–0003 (journal); this runner covers all of them.
(timeout 120 npm run db:migrate:all || {
  echo "Warning: db:migrate:all timed out or failed after 120s"
}) &
npm start
