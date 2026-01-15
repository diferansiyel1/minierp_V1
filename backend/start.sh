#!/bin/sh
set -e

echo "Starting deployment script..."

# Wait for 5 seconds to ensure DB is fully ready (extra safety)
echo "Waiting for database to initialize..."
sleep 5

# Run migrations with retry logic
echo "Running database migrations..."
cd /app/backend

# Retry loop for alembic
n=0
until [ "$n" -ge 5 ]
do
   echo "Migration attempt $((n+1))..."
   alembic upgrade head && break
   n=$((n+1))
   echo "Migration failed. Retrying in 5 seconds..."
   sleep 5
done

if [ "$n" -ge 5 ]; then
   echo "Migration failed after 5 attempts."
   exit 1
fi

echo "Migrations completed successfully."

# Start application
echo "Starting application with Uvicorn..."
cd /app
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
