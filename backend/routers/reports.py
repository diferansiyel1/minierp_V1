from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
from datetime import datetime, date
from io import StringIO
import csv

from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    responses={404: {"description": "Not found"}},
)


@router.get("/technopark-monthly")
def get_technopark_monthly_report(
    year: int,
    month: int,
    db: Session = Depends(get_db)
):
    """
    Aylık Teknokent Muafiyet Raporu
    O ay kesilen satış faturaları ile istisna matrahlarını listeler
    """
    invoices = db.query(models.Invoice).filter(
        models.Invoice.invoice_type == models.InvoiceType.SALES,
        extract('year', models.Invoice.issue_date) == year,
        extract('month', models.Invoice.issue_date) == month
    ).all()
    
    report_data = []
    total_exempt = 0.0
    total_taxable = 0.0
    total_vat = 0.0
    
    for inv in invoices:
        account = db.query(models.Account).filter(
            models.Account.id == inv.account_id
        ).first()
        
        project = None
        if inv.project_id:
            project = db.query(models.Project).filter(
                models.Project.id == inv.project_id
            ).first()
        
        report_data.append({
            "invoice_no": inv.invoice_no or f"FTR-{inv.id}",
            "issue_date": inv.issue_date.strftime("%d.%m.%Y") if inv.issue_date else None,
            "account_title": account.title if account else "-",
            "project_code": project.code if project else "-",
            "project_name": project.name if project else "-",
            "exempt_amount": inv.exempt_amount,
            "taxable_amount": inv.taxable_amount,
            "vat_amount": inv.vat_amount,
            "total_amount": inv.total_amount
        })
        
        total_exempt += inv.exempt_amount
        total_taxable += inv.taxable_amount
        total_vat += inv.vat_amount
    
    return {
        "year": year,
        "month": month,
        "report_date": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "invoices": report_data,
        "summary": {
            "total_exempt_amount": total_exempt,
            "total_taxable_amount": total_taxable,
            "total_vat_amount": total_vat,
            "invoice_count": len(report_data)
        }
    }


@router.get("/project-pnl/{project_id}")
def get_project_pnl(project_id: int, db: Session = Depends(get_db)):
    """
    Proje Kârlılık Raporu (Profit & Loss)
    Projenin gelir, gider ve net kârını hesaplar
    """
    project = db.query(models.Project).filter(
        models.Project.id == project_id
    ).first()
    
    if not project:
        return {"error": "Proje bulunamadı"}
    
    # Satış Faturaları (Gelir)
    sales_invoices = db.query(models.Invoice).filter(
        models.Invoice.project_id == project_id,
        models.Invoice.invoice_type == models.InvoiceType.SALES
    ).all()
    
    total_income = sum(inv.total_amount for inv in sales_invoices)
    total_income_exempt = sum(inv.exempt_amount for inv in sales_invoices)
    total_vat_collected = sum(inv.vat_amount for inv in sales_invoices)
    
    # Alış Faturaları (Gider)
    purchase_invoices = db.query(models.Invoice).filter(
        models.Invoice.project_id == project_id,
        models.Invoice.invoice_type == models.InvoiceType.PURCHASE
    ).all()
    
    total_expense = sum(inv.total_amount for inv in purchase_invoices)
    
    # Gider kategorilerine göre dağılım
    expense_by_category = {}
    for inv in purchase_invoices:
        cat = inv.expense_category or "Diğer"
        if cat not in expense_by_category:
            expense_by_category[cat] = 0.0
        expense_by_category[cat] += inv.total_amount
    
    net_profit = total_income - total_expense
    remaining_budget = project.budget - project.spent_budget
    
    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "code": project.code,
            "status": project.status,
            "is_technopark": project.is_technopark_project,
            "budget": project.budget,
            "spent_budget": project.spent_budget,
            "remaining_budget": remaining_budget
        },
        "income": {
            "total_income": total_income,
            "total_income_exempt": total_income_exempt,
            "total_income_taxable": total_income - total_income_exempt,
            "total_vat_collected": total_vat_collected,
            "invoice_count": len(sales_invoices)
        },
        "expense": {
            "total_expense": total_expense,
            "expense_by_category": expense_by_category,
            "invoice_count": len(purchase_invoices)
        },
        "profit": {
            "net_profit": net_profit,
            "profit_margin": (net_profit / total_income * 100) if total_income > 0 else 0
        }
    }


@router.get("/technopark-monthly/csv")
def export_technopark_monthly_csv(
    year: int,
    month: int,
    db: Session = Depends(get_db)
):
    """
    Aylık Teknokent raporu CSV export
    """
    report = get_technopark_monthly_report(year, month, db)
    
    output = StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "Fatura No", "Tarih", "Firma", "Proje Kodu", "Proje Adı",
        "İstisna Matrahı", "KDV'li Matrah", "KDV Tutarı", "Toplam"
    ])
    
    # Data rows
    for inv in report["invoices"]:
        writer.writerow([
            inv["invoice_no"],
            inv["issue_date"],
            inv["account_title"],
            inv["project_code"],
            inv["project_name"],
            inv["exempt_amount"],
            inv["taxable_amount"],
            inv["vat_amount"],
            inv["total_amount"]
        ])
    
    # Summary row
    writer.writerow([])
    writer.writerow([
        "TOPLAM", "", "", "", "",
        report["summary"]["total_exempt_amount"],
        report["summary"]["total_taxable_amount"],
        report["summary"]["total_vat_amount"],
        ""
    ])
    
    output.seek(0)
    
    filename = f"teknokent_rapor_{year}_{month:02d}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
