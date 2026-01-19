from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from .auth import get_current_active_user, hash_password

router = APIRouter(
    prefix="/users",
    tags=["users"],
    responses={404: {"description": "Not found"}},
)

def check_admin_privileges(current_user: models.User):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için yetkiniz bulunmamaktadır."
        )

@router.get("/", response_model=List[schemas.User])
def read_users(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Tenant içindeki kullanıcıları listele (Sadece Admin)"""
    check_admin_privileges(current_user)
    
    if current_user.role == models.UserRole.SUPERADMIN:
        # Superadmin hepsini görür
        users = db.query(models.User).offset(skip).limit(limit).all()
    else:
        # Tenant admin sadece kendi tenant userlarını görür
        users = db.query(models.User).filter(
            models.User.tenant_id == current_user.tenant_id
        ).offset(skip).limit(limit).all()
        
    return users

@router.post("/", response_model=schemas.User)
def create_user(
    user: schemas.UserCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Yeni kullanıcı oluştur (Sadece Admin)"""
    check_admin_privileges(current_user)
    
    # Email kontrolü
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Bu email adresi zaten kullanımda.")
    
    new_user = models.User(
        email=user.email,
        hashed_password=hash_password(user.password),
        full_name=user.full_name,
        role=user.role,
        is_active=True,
        tenant_id=current_user.tenant_id # Admin'in tenantına ekle
    )
    
    if current_user.role == models.UserRole.SUPERADMIN:
        # Superadmin ise tenant_id payload'dan gelebilir ama şimdilik basit tutalım
        # Varsayılan olarak superadmin kendi tenantına ekler veya explicit belirtilmeli
        pass
        
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.put("/{user_id}", response_model=schemas.User)
def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Kullanıcı güncelle"""
    check_admin_privileges(current_user)
    
    # Kullanıcıyı bul
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
    # Tenant kontrolü (Başkabir tenantın kullanıcısını düzenlemeye çalışmasın)
    if current_user.role != models.UserRole.SUPERADMIN and user.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Bu kullanıcıyı düzenleme yetkiniz yok")
        
    if user_update.full_name:
        user.full_name = user_update.full_name
    if user_update.password:
        user.hashed_password = hash_password(user_update.password)
        
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Kullanıcıyı pasife al (Soft delete)"""
    check_admin_privileges(current_user)
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
    if current_user.role != models.UserRole.SUPERADMIN and user.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
        
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Kendinizi silemezsiniz")
        
    user.is_active = False
    db.commit()
    
    return {"message": "Kullanıcı başarıyla pasife alındı"}
