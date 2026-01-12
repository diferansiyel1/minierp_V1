from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=List[schemas.SystemSetting])
def read_settings(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Tüm sistem ayarlarını getir"""
    settings = db.query(models.SystemSetting).offset(skip).limit(limit).all()
    return settings

@router.get("/{key}", response_model=schemas.SystemSetting)
def read_setting(key: str, db: Session = Depends(get_db)):
    """Belirli bir ayarı getir"""
    setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting

@router.post("/", response_model=schemas.SystemSetting)
def create_setting(setting: schemas.SystemSettingCreate, db: Session = Depends(get_db)):
    """Yeni ayar oluştur"""
    db_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == setting.key).first()
    if db_setting:
        raise HTTPException(status_code=400, detail="Setting already exists")
    
    db_setting = models.SystemSetting(
        key=setting.key,
        value=setting.value,
        description=setting.description
    )
    db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    return db_setting

@router.put("/{key}", response_model=schemas.SystemSetting)
def update_setting(key: str, setting: schemas.SystemSettingUpdate, db: Session = Depends(get_db)):
    """Ayarı güncelle"""
    db_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == key).first()
    if not db_setting:
        # Create if not exists (upsert logic mostly preferred for settings)
        db_setting = models.SystemSetting(
            key=key,
            value=setting.value,
            description=setting.description
        )
        db.add(db_setting)
        db.commit()
        db.refresh(db_setting)
        return db_setting
    
    db_setting.value = setting.value
    if setting.description is not None:
        db_setting.description = setting.description
        
    db.commit()
    db.refresh(db_setting)
    return db_setting
