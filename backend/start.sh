#!/bin/sh
set -e

# Run migrations
echo "Running database migrations..."
cd /app/backend
alembic upgrade head

# Start application
echo "Starting application..."
cd /app
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
