from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import json
from .. import models, schemas
from ..database import get_db
from .auth import get_current_active_user, get_current_user
from ..services.tax_service import TaxService, get_tax_service

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


# ==================== TAX PARAMETERS ENDPOINTS ====================

@router.get("/tax-parameters", response_model=schemas.TaxParameters2026)
def get_tax_parameters(
    year: int = 2026,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Vergi parametrelerini getir
    
    5746/4691 Sayılı Kanun kapsamında Teknokent vergi istisna parametreleri.
    """
    tax_service = get_tax_service(db)
    params = tax_service.get_tax_parameters(year)
    return schemas.TaxParameters2026(**params)


@router.patch("/tax-parameters", response_model=schemas.TaxParameters2026)
def update_tax_parameters(
    updates: schemas.TaxParametersUpdate,
    year: int = 2026,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Vergi parametrelerini güncelle
    
    Sadece admin ve superadmin kullanıcılar bu endpoint'i kullanabilir.
    """
    # Yetki kontrolü
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Bu işlem için admin yetkisi gereklidir")
    
    # Validasyon - oranlar 0-1 arasında olmalı
    if updates.venture_capital_rate is not None and not (0 <= updates.venture_capital_rate <= 1):
        raise HTTPException(status_code=400, detail="Girişim sermayesi oranı 0-1 arasında olmalıdır")
    
    if updates.corporate_tax_rate is not None and not (0 <= updates.corporate_tax_rate <= 1):
        raise HTTPException(status_code=400, detail="Kurumlar vergisi oranı 0-1 arasında olmalıdır")
    
    if updates.vat_rate is not None and not (0 <= updates.vat_rate <= 1):
        raise HTTPException(status_code=400, detail="KDV oranı 0-1 arasında olmalıdır")
    
    if updates.remote_work_rate_informatics is not None and not (0 <= updates.remote_work_rate_informatics <= 1):
        raise HTTPException(status_code=400, detail="Bilişim personeli uzaktan çalışma oranı 0-1 arasında olmalıdır")
    
    if updates.remote_work_rate_other is not None and not (0 <= updates.remote_work_rate_other <= 1):
        raise HTTPException(status_code=400, detail="Diğer personel uzaktan çalışma oranı 0-1 arasında olmalıdır")
    
    if updates.sgk_employer_share_discount is not None and not (0 <= updates.sgk_employer_share_discount <= 1):
        raise HTTPException(status_code=400, detail="SGK işveren hissesi indirimi 0-1 arasında olmalıdır")
    
    tax_service = get_tax_service(db)
    return tax_service.update_tax_parameters(year, updates)


@router.get("/tax-parameters/calculate", response_model=schemas.MonthlyTaxCalculationResult)
def calculate_monthly_tax(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Aylık vergi avantajı hesapla
    
    Belirtilen ay için kurumlar vergisi istisnası, KDV muafiyeti ve personel teşviklerini hesaplar.
    """
    if not 1 <= month <= 12:
        raise HTTPException(status_code=400, detail="Ay 1-12 arasında olmalıdır")
    
    tenant_id = current_user.tenant_id
    tax_service = get_tax_service(db)
    
    return tax_service.calculate_monthly_tax_summary(tenant_id, year, month)


@router.get("/tax-parameters/yearly-summary", response_model=schemas.YearlyTaxSummary)
def get_yearly_tax_summary(
    year: int = 2026,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Yıllık vergi avantajı özeti
    
    Belirtilen yıl için toplam vergi avantajlarını hesaplar.
    """
    tenant_id = current_user.tenant_id
    tax_service = get_tax_service(db)
    
    return tax_service.calculate_yearly_summary(tenant_id, year)

