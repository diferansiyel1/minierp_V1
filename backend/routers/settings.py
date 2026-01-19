from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import json
from .. import models, schemas
from ..database import get_db
from .auth import get_current_active_user, get_current_user

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
    responses={404: {"description": "Not found"}},
)

@router.get("/company", response_model=schemas.CompanySettings)
def get_company_info(
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Firma bilgilerini (Tenant settings) getir"""
    if not current_user.tenant:
        # If superadmin, return empty settings instead of error
        if current_user.role == models.UserRole.SUPERADMIN:
            return schemas.CompanySettings()
        raise HTTPException(status_code=400, detail="User is not associated with a tenant")
        
    settings_json = current_user.tenant.settings
    if not settings_json:
        return schemas.CompanySettings()
        
    try:
        settings_dict = json.loads(settings_json)
        return schemas.CompanySettings(**settings_dict)
    except json.JSONDecodeError:
        return schemas.CompanySettings()

@router.post("/company", response_model=schemas.CompanySettings)
def update_company_info(
    settings: schemas.CompanySettings,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Firma bilgilerini güncelle"""
    if not current_user.tenant:
        if current_user.role == models.UserRole.SUPERADMIN:
            # For now, superadmin cannot update tenant settings via this endpoint as they have no tenant.
            # We could redirect to system settings or just ignore.
            raise HTTPException(status_code=400, detail="Superadmin cannot update company settings via this endpoint. Use Tenant Management.")
        raise HTTPException(status_code=400, detail="User is not associated with a tenant")
    
    # Mevcut ayarları al
    current_settings_json = current_user.tenant.settings
    current_settings = {}
    if current_settings_json:
        try:
            current_settings = json.loads(current_settings_json)
        except:
            pass
    
    # Yeni ayarları birleştir
    new_settings = settings.model_dump(exclude_unset=True)
    current_settings.update(new_settings)
    
    # Kaydet
    current_user.tenant.settings = json.dumps(current_settings)
    db.commit()
    
    return schemas.CompanySettings(**current_settings)

@router.get("/", response_model=List[schemas.SystemSetting])
def read_settings(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    """Sistem ayarlarını getir (Backward compatibility for global settings if needed)"""
    # For now, we still return global settings for non-tenant specific things or migrate entirely.
    # User requested Company Info specifically. Global settings might be admin only.
    settings = db.query(models.SystemSetting).offset(skip).limit(limit).all()
    return settings

