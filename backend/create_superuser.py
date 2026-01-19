from sqlalchemy.orm import Session
from backend.database import SessionLocal, engine, Base
from backend.models import User, UserRole, Tenant
from backend.routers.auth import hash_password
import sys

def create_ids():
    # Create Tables (Development Mode)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 1. Create System Tenant if not exists
        tenant_name = "System Tenant"
        tenant = db.query(Tenant).filter(Tenant.name == tenant_name).first()
        if not tenant:
            tenant = Tenant(
                name=tenant_name,
                slug="system",
                is_active=True,
                settings='{"company_name": "MiniERP System"}'
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
            print(f"Created Tenant: {tenant.name} (ID: {tenant.id})")
        else:
            print(f"Tenant exists: {tenant.name} (ID: {tenant.id})")

        # 2. Create Super Admin User
        email = "admin@minierp.com"
        password = "admin"  # In production, ask for input
        
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                hashed_password=hash_password(password),
                full_name="Super Admin",
                role=UserRole.SUPERADMIN,
                is_active=True,
                is_superuser=True,
                tenant_id=tenant.id
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created Super Admin: {user.email}")
            print(f"Password: {password}")
        else:
            print(f"User exists: {user.email}")
            # Optional: Reset password if exists? 
            # user.hashed_password = hash_password(password)
            # db.commit()
            # print(f"Password reset to: {password}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_ids()
