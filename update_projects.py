
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models import Project

# Assuming standard sqlite URL
SQLALCHEMY_DATABASE_URL = "sqlite:///./app.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

db = SessionLocal()
try:
    # Update all projects to be technopark projects for now, or specific one
    projects = db.query(Project).all()
    for p in projects:
        if "QorSense" in p.name or "Qorsense" in p.name:
            print(f"Updating project: {p.name}")
            p.is_technopark_project = True
            db.add(p)
    db.commit()
    print("Update complete.")
finally:
    db.close()
