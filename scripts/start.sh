#!/bin/bash
set -e
echo "Running migrations..."
# Timeout after 60s — Railway internal DB can occasionally hang on first connect
timeout 60 npm run db:migrate || {
  echo "Warning: db:migrate timed out or failed — continuing startup (table may already exist)"
}
echo "Starting app..."
npm start
