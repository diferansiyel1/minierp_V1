
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models import Project
from backend.database import Base

# Assuming standard sqlite URL if not imported from database.py
SQLALCHEMY_DATABASE_URL = "sqlite:///./app.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

db = SessionLocal()
try:
    projects = db.query(Project).all()
    print(f"Found {len(projects)} projects:")
    for p in projects:
        print(f"ID: {p.id}, Code: {p.code}, Name: {p.name}, IsTechnopark: {p.is_technopark_project}")
finally:
    db.close()
