#!/bin/bash
set -e
echo "Running migrations..."
npm run db:migrate
echo "Starting app..."
npm start
