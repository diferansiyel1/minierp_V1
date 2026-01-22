from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
import shutil
import os
from datetime import datetime
from io import BytesIO

from .. import models, schemas
from ..database import get_db
from ..services.tax_service import TaxService, get_tax_service
from ..services.reporting_service import ReportingService, get_reporting_service
from .auth import get_current_active_user

router = APIRouter(
    prefix="/exemption-reports",
    tags=["exemption-reports"],
)

UPLOAD_DIR = "uploads/exemption_reports"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/", response_model=List[schemas.ExemptionReport])
def get_exemption_reports(
    project_id: Optional[int] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.ExemptionReport)
    
    if project_id:
        query = query.filter(models.ExemptionReport.project_id == project_id)
    if year:
        query = query.filter(models.ExemptionReport.year == year)
    if month:
        query = query.filter(models.ExemptionReport.month == month)
        
    return query.order_by(models.ExemptionReport.year.desc(), models.ExemptionReport.month.desc()).all()

@router.post("/", response_model=schemas.ExemptionReport)
def create_exemption_report(
    project_id: int = Form(...),
    year: int = Form(...),
    month: int = Form(...),
    notes: Optional[str] = Form(None),
    total_personnel_cost: float = Form(0.0),
    total_rd_expense: float = Form(0.0),
    total_exempt_income: float = Form(0.0),
    total_taxable_income: float = Form(0.0),
    personnel_income_tax_exemption_amount: float = Form(0.0),
    personnel_sgk_exemption_amount: float = Form(0.0),
    personnel_stamp_tax_exemption_amount: float = Form(0.0),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Check if report already exists for this period
    existing = db.query(models.ExemptionReport).filter(
        models.ExemptionReport.project_id == project_id,
        models.ExemptionReport.year == year,
        models.ExemptionReport.month == month
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Report already exists for this period")

    # Save file
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"report_{project_id}_{year}_{month}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Calculate Tax Exemptions
    # 1. Corporate Tax Exemption (Kurumlar Vergisi İstisnası)
    # Net Ar-Ge Kazancı üzerinden %25
    net_exempt_profit = max(0.0, total_exempt_income - total_rd_expense)
    corporate_tax_exemption_amount = net_exempt_profit * 0.25
    
    # 2. VAT Exemption (KDV İstisnası)
    # KDV'den muaf faturaların KDV tutarı (%20 olarak varsayılıyor)
    vat_exemption_amount = total_exempt_income * 0.20
    
    # 3. Total Advantage
    total_tax_advantage = (
        corporate_tax_exemption_amount +
        vat_exemption_amount +
        personnel_income_tax_exemption_amount +
        personnel_sgk_exemption_amount +
        personnel_stamp_tax_exemption_amount
    )
        
    db_report = models.ExemptionReport(
        project_id=project_id,
        year=year,
        month=month,
        notes=notes,
        file_path=file_path,
        file_name=file.filename,
        total_personnel_cost=total_personnel_cost,
        total_rd_expense=total_rd_expense,
        total_exempt_income=total_exempt_income,
        total_taxable_income=total_taxable_income,
        
        # Tax Exemptions
        corporate_tax_exemption_amount=corporate_tax_exemption_amount,
        vat_exemption_amount=vat_exemption_amount,
        personnel_income_tax_exemption_amount=personnel_income_tax_exemption_amount,
        personnel_sgk_exemption_amount=personnel_sgk_exemption_amount,
        personnel_stamp_tax_exemption_amount=personnel_stamp_tax_exemption_amount,
        total_tax_advantage=total_tax_advantage
    )
    
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report

@router.delete("/{id}")
def delete_exemption_report(id: int, db: Session = Depends(get_db)):
    report = db.query(models.ExemptionReport).filter(models.ExemptionReport.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    # Delete file
    if os.path.exists(report.file_path):
        os.remove(report.file_path)
        
    db.delete(report)
    db.commit()
    return {"message": "Report deleted"}

@router.get("/{id}/download")
def download_exemption_report(id: int, db: Session = Depends(get_db)):
    report = db.query(models.ExemptionReport).filter(models.ExemptionReport.id == id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    if not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(
        report.file_path, 
        filename=report.file_name,
        media_type="application/pdf"
    )

@router.get("/monthly-accounting")
def get_monthly_accounting(
    project_id: int,
    year: int,
    month: int,
    db: Session = Depends(get_db)
):
    """
    Belirli bir proje ve dönem için muhasebe özetini hesaplar.
    """
    
    # 1. Gelirler (Satış Faturaları)
    sales_invoices = db.query(models.Invoice).filter(
        models.Invoice.project_id == project_id,
        models.Invoice.invoice_type == models.InvoiceType.SALES,
        extract('year', models.Invoice.issue_date) == year,
        extract('month', models.Invoice.issue_date) == month
    ).all()
    
    total_income_exempt = sum(inv.exempt_amount for inv in sales_invoices)
    total_income_taxable = sum(inv.taxable_amount for inv in sales_invoices)
    total_vat_collected = sum(inv.vat_amount for inv in sales_invoices)
    
    # 2. Giderler (Alış Faturaları)
    # Projeye ait gider faturaları
    project_expenses = db.query(models.Invoice).filter(
        models.Invoice.project_id == project_id,
        models.Invoice.invoice_type == models.InvoiceType.PURCHASE,
        models.Invoice.is_project_expense == True,
        extract('year', models.Invoice.issue_date) == year,
        extract('month', models.Invoice.issue_date) == month
    ).all()
    
    # Kategoriye göre dağılım
    expense_breakdown = {}
    total_expense = 0.0
    
    for inv in project_expenses:
        cat = inv.expense_category or "Diğer"
        if cat not in expense_breakdown:
            expense_breakdown[cat] = 0.0
        expense_breakdown[cat] += inv.total_amount
        total_expense += inv.total_amount
        
    # Personel Giderleri (Şimdilik manuel veya ayrı bir tablodan gelebilir, şu an 0)
    # Gelecekte Personel modülü eklendiğinde buradan çekilecek
    personnel_expense = 0.0 
    
    # Calculate estimated exemptions for display
    # Kurumlar Vergisi (%25)
    net_profit_exempt = max(0.0, total_income_exempt - total_expense) # Basitçe toplam gideri düşüyoruz
    estimated_corporate_tax_exemption = net_profit_exempt * 0.25
    
    # KDV (%20)
    estimated_vat_exemption = total_income_exempt * 0.20
    
    return {
        "income": {
            "exempt": total_income_exempt,
            "taxable": total_income_taxable,
            "vat": total_vat_collected,
            "total": total_income_exempt + total_income_taxable
        },
        "expense": {
            "total": total_expense,
            "personnel": personnel_expense,
            "breakdown": expense_breakdown
        },
        "summary": {
            "net_result": (total_income_exempt + total_income_taxable) - total_expense,
        },
        "calculated_tax_advantages": {
            "corporate_tax": estimated_corporate_tax_exemption,
            "vat": estimated_vat_exemption
        }
    }


# ==================== PDF RAPOR OLUŞTURMA ====================

@router.get("/generate-pdf")
def generate_monthly_exemption_pdf(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Aylık Teknokent Muafiyet Raporu PDF Oluştur
    
    YMM (Yeminli Mali Müşavir) formatında detaylı rapor:
    - Proje Özeti
    - Gelir Analizi (KDV Muafiyeti Kod 351)
    - Personel Analizi
    - Kurumlar Vergisi Hesaplaması
    - Girişim Sermayesi Uyarısı (5M TL üzeri için)
    """
    if not 1 <= month <= 12:
        raise HTTPException(status_code=400, detail="Ay 1-12 arasında olmalıdır")
    
    tenant_id = current_user.tenant_id
    reporting_service = get_reporting_service(db)
    
    # PDF oluştur
    pdf_buffer = reporting_service.generate_monthly_exemption_report(
        tenant_id=tenant_id,
        year=year,
        month=month
    )
    
    # Ay adları
    month_names = [
        "", "Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran",
        "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"
    ]
    month_name = month_names[month] if 1 <= month <= 12 else str(month)
    
    filename = f"Teknokent_Muafiyet_Raporu_{month_name}_{year}.pdf"
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.post("/generate-and-save", response_model=schemas.ExemptionReport)
def generate_and_save_exemption_report(
    project_id: int,
    year: int,
    month: int,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Aylık muafiyet raporunu hesapla, PDF oluştur ve kaydet
    
    Bu endpoint:
    1. Vergi hesaplamalarını yapar
    2. PDF raporu oluşturur
    3. Raporu veritabanına kaydeder
    """
    if not 1 <= month <= 12:
        raise HTTPException(status_code=400, detail="Ay 1-12 arasında olmalıdır")
    
    tenant_id = current_user.tenant_id
    
    # Mevcut rapor kontrolü
    existing = db.query(models.ExemptionReport).filter(
        models.ExemptionReport.project_id == project_id,
        models.ExemptionReport.year == year,
        models.ExemptionReport.month == month
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Bu dönem için rapor zaten mevcut")
    
    # Proje kontrolü
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proje bulunamadı")
    
    # Vergi hesaplamalarını yap
    tax_service = get_tax_service(db)
    tax_result = tax_service.calculate_monthly_tax_summary(tenant_id, year, month)
    
    # PDF oluştur
    reporting_service = get_reporting_service(db)
    pdf_buffer = reporting_service.generate_monthly_exemption_report(
        tenant_id=tenant_id,
        year=year,
        month=month
    )
    
    # PDF'i kaydet
    month_names = [
        "", "Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran",
        "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"
    ]
    month_name = month_names[month] if 1 <= month <= 12 else str(month)
    
    filename = f"Teknokent_Muafiyet_Raporu_{project.code}_{month_name}_{year}.pdf"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    with open(file_path, "wb") as f:
        f.write(pdf_buffer.getvalue())
    
    # Veritabanına kaydet
    db_report = models.ExemptionReport(
        tenant_id=tenant_id,
        project_id=project_id,
        year=year,
        month=month,
        notes=notes,
        file_path=file_path,
        file_name=filename,
        
        # Muhasebe özet bilgileri
        total_personnel_cost=0.0,  # Şimdilik
        total_rd_expense=tax_result.corporate_tax.total_rd_expense,
        total_exempt_income=tax_result.corporate_tax.total_exempt_income,
        total_taxable_income=0.0,  # Şimdilik
        
        # Vergi istisnaları
        corporate_tax_exemption_amount=tax_result.corporate_tax.corporate_tax_exemption,
        vat_exemption_amount=tax_result.corporate_tax.vat_exemption,
        personnel_income_tax_exemption_amount=sum(p.calculated_income_tax_exemption for p in tax_result.personnel_incentives),
        personnel_sgk_exemption_amount=sum(p.sgk_employer_discount for p in tax_result.personnel_incentives),
        personnel_stamp_tax_exemption_amount=sum(p.stamp_tax_exemption for p in tax_result.personnel_incentives),
        total_tax_advantage=tax_result.total_tax_advantage,
        
        # Yeni alanlar
        venture_capital_obligation=tax_result.corporate_tax.venture_capital_obligation,
        is_venture_capital_invested=False,
        remote_work_ratio_applied=1.0,
        calculated_tax_advantage=tax_result.total_tax_advantage,
        exemption_base=tax_result.corporate_tax.exemption_base
    )
    
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    return db_report
