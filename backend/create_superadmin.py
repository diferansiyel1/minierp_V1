import sys
import os

# Add parent directory to path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal, engine
from backend import models
from backend.routers.auth import hash_password

def create_superadmin():
    db = SessionLocal()
    
    email = "superadmin@minierp.com"
    password = "admin" # Change this in production!
    
    # Check if exists
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        print(f"Superadmin {email} already exists.")
        
        # Update role if needed
        if existing.role != models.UserRole.SUPERADMIN:
            existing.role = models.UserRole.SUPERADMIN
            db.commit()
            print("Updated role to SUPERADMIN.")
        
        return

    user = models.User(
        email=email,
        hashed_password=hash_password(password),
        full_name="Super Admin",
        role=models.UserRole.SUPERADMIN,
        is_active=True,
        tenant_id=None # Superadmin belongs to no tenant (or system tenant)
    )
    
    db.add(user)
    db.commit()
    print(f"Created superadmin: {email} / {password}")
    db.close()

if __name__ == "__main__":
    create_superadmin()
