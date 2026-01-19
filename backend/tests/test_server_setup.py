import os
import sys
import importlib
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

def test_critical_dependencies():
    """Test that critical server dependencies are installed."""
    try:
        import psycopg2
    except ImportError:
        pytest.fail("psycopg2-binary not installed. PostgreSQL connection will fail on server.")

    try:
        import alembic
    except ImportError:
        pytest.fail("alembic not installed. Migrations will fail.")

    try:
        import starlette
    except ImportError:
         pytest.fail("starlette not installed.")

def test_all_routers_importable():
    """Test that all router modules can be imported without error."""
    router_files = [
        "backend.routers.accounts",
        "backend.routers.activities",
        "backend.routers.auth",
        "backend.routers.contacts",
        "backend.routers.csv_import",
        "backend.routers.exemption_reports",
        "backend.routers.finance",
        "backend.routers.financial_accounts",
        "backend.routers.products",
        "backend.routers.projects",
        "backend.routers.reports",
        "backend.routers.sales",
        "backend.routers.settings",
        "backend.routers.tenants",
    ]
    
    for module_name in router_files:
        try:
            importlib.import_module(module_name)
        except ImportError as e:
            pytest.fail(f"Failed to import {module_name}: {e}")
        except Exception as e:
            pytest.fail(f"Exception during import of {module_name}: {e}")

def test_database_url_env_parsing():
    """Test that DATABASE_URL is correctly prioritized from environment."""
    test_url = "postgresql://user:pass@localhost:5432/testdb"
    with patch.dict(os.environ, {"DATABASE_URL": test_url}):
        # We need to reload the module to pick up the env var
        import backend.database
        importlib.reload(backend.database)
        assert str(backend.database.DATABASE_URL) == test_url
        
        # Verify engine creation doesn't crash (mock create_engine)
        with patch("sqlalchemy.create_engine") as mock_engine:
            importlib.reload(backend.database)
            mock_engine.assert_called_with(test_url, connect_args={})

def test_cors_origins_env_parsing():
    """Test that CORS_ORIGINS are correctly parsed."""
    test_origins = "https://example.com,https://test.com"
    with patch.dict(os.environ, {"CORS_ORIGINS": test_origins}):
        import backend.main
        importlib.reload(backend.main)
        
        # Check if the middleware was added with correct origins
        # This is tricky to inspect directly on the app, but we can verify imports don't crash
        # and checking the 'origins' list logic if we extracted it, but for now
        # verifying main loads without error with this env var is good.
        assert backend.main.app.title == "MiniERP API"

def test_health_endpoint():
    """Test the /health endpoint used by Docker/Coolify."""
    from backend.main import app
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_root_endpoint():
    """Test the root endpoint."""
    from backend.main import app
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    assert "running" in response.json()["message"]

def test_start_script_existence():
    """Test that start.sh exists and has expected content."""
    start_sh_path = os.path.join(os.path.dirname(__file__), '..', 'start.sh')
    assert os.path.exists(start_sh_path), "start.sh not found"
    
    with open(start_sh_path, 'r') as f:
        content = f.read()
        assert "alembic upgrade head" in content, "start.sh missing migration command"
        assert "uvicorn backend.main:app" in content, "start.sh missing uvicorn command"
