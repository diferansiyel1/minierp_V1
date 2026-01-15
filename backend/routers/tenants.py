from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from .auth import get_current_active_user, hash_password

router = APIRouter(
    prefix="/tenants",
    tags=["tenants"],
    responses={404: {"description": "Not found"}},
)

def check_superadmin(current_user: models.User = Depends(get_current_active_user)):
    if current_user.role != models.UserRole.SUPERADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

@router.post("/", response_model=schemas.Tenant)
def create_tenant(
    tenant: schemas.TenantCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_superadmin)
):
    """Create a new tenant (Superadmin only)"""
    db_tenant = models.Tenant(**tenant.dict())
    db.add(db_tenant)
    db.commit()
    db.refresh(db_tenant)
    return db_tenant

@router.get("/", response_model=List[schemas.Tenant])
def read_tenants(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_superadmin)
):
    """List all tenants (Superadmin only)"""
    tenants = db.query(models.Tenant).offset(skip).limit(limit).all()
    return tenants

@router.get("/{tenant_id}", response_model=schemas.Tenant)
def read_tenant(
    tenant_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_superadmin)
):
    """Get tenant details (Superadmin only)"""
    tenant = db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant

@router.put("/{tenant_id}", response_model=schemas.Tenant)
def update_tenant(
    tenant_id: int, 
    tenant_update: schemas.TenantUpdate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_superadmin)
):
    """Update tenant (Superadmin only)"""
    db_tenant = db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
    if not db_tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    update_data = tenant_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_tenant, key, value)
    
    db.commit()
    db.refresh(db_tenant)
    return db_tenant

@router.post("/{tenant_id}/admin", response_model=schemas.User)
def create_tenant_admin(
    tenant_id: int,
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_superadmin)
):
    """Create an admin user for a tenant"""
    # Verify tenant exists
    tenant = db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Check if user exists
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_user = models.User(
        email=user.email,
        hashed_password=hash_password(user.password),
        full_name=user.full_name,
        role=models.UserRole.ADMIN,
        tenant_id=tenant_id,
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
