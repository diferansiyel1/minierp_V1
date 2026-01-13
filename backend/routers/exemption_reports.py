from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
import shutil
import os
from datetime import datetime

from .. import models, schemas
from ..database import get_db

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
