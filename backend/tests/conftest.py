import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from typing import Generator

from backend.main import app
from backend.database import get_db, Base
from backend.models import User, UserRole
from backend.routers.auth import create_access_token

# Use in-memory SQLite for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
from sqlalchemy import event
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def db_engine():
    # Create tables
    Base.metadata.create_all(bind=engine)
    yield engine
    # Drop tables
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db(db_engine):
    connection = db_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    del app.dependency_overrides[get_db]

@pytest.fixture(scope="function")
def tenant(db):
    from backend.models import Tenant
    tenant = Tenant(id=1, name="Test Tenant", slug="test", is_active=True)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant

@pytest.fixture(scope="function")
def test_user(db, tenant):
    user = User(
        email="test@example.com",
        hashed_password="hashedpassword",
        full_name="Test User",
        is_active=True,
        role=UserRole.USER,
        tenant_id=tenant.id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture(scope="function")
def admin_user(db, tenant):
    user = User(
        email="admin@example.com",
        hashed_password="hashedpassword",
        full_name="Admin User",
        is_active=True,
        role=UserRole.SUPERADMIN,
        tenant_id=tenant.id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture(scope="function")
def token_headers(test_user):
    access_token = create_access_token(test_user.email)
    return {"Authorization": f"Bearer {access_token}"}

@pytest.fixture(scope="function")
def admin_token_headers(admin_user):
    access_token = create_access_token(admin_user.email)
    return {"Authorization": f"Bearer {access_token}"}
