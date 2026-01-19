#!/bin/sh

echo "========================================="
echo "MiniERP Backend Startup Script"
echo "========================================="

# Print environment for debugging
echo ""
echo "[DEBUG] Environment:"
echo "  DATABASE_URL: $(if echo "$DATABASE_URL" | grep -q "postgresql"; then echo "PostgreSQL (Configured)"; else echo "SQLite (Default/Fallback)"; fi)"
echo "  PYTHONPATH: ${PYTHONPATH:-'NOT SET'}"
echo "  PWD: $(pwd)"
echo ""

# Wait for database to be ready
echo "[STEP 1] Waiting for database to initialize..."
sleep 5

# Run migrations with retry logic
echo "[STEP 2] Running database migrations..."
cd /app/backend

# Check if alembic.ini exists
if [ ! -f "alembic.ini" ]; then
    echo "[ERROR] alembic.ini not found in /app/backend!"
    ls -la /app/backend/
    exit 1
fi

# Retry loop for alembic
n=0
until [ "$n" -ge 5 ]
do
   echo "  Migration attempt $((n+1))..."
   alembic upgrade head 2>&1 && break
   n=$((n+1))
   echo "  Migration failed. Retrying in 5 seconds..."
   sleep 5
done

if [ "$n" -ge 5 ]; then
   echo "[WARNING] Migration failed after 5 attempts. Continuing anyway (database might already be up-to-date)..."
fi

echo "[STEP 2] Migrations completed."

echo "[STEP 2.5] Creating Superadmin..."
# Try to run create_superadmin.py - ignore failure if unique constraint hit
python3 create_superadmin.py || echo "[INFO] Superadmin creation script skipped or failed (likely already exists)."

# Start application
echo ""
echo "[STEP 3] Starting Uvicorn server..."
cd /app
echo "  Running: uvicorn backend.main:app --host 0.0.0.0 --port 8000 --log-level debug"
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --log-level debug
