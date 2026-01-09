from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime
from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/finance",
    tags=["finance"],
    responses={404: {"description": "Not found"}},
)

@router.post("/invoices", response_model=schemas.Invoice)
def create_invoice(invoice: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    """Fatura oluştur (Satış veya Alış)"""
    # Calculate totals
    subtotal = 0.0
    total_vat = 0.0
    
    db_invoice = models.Invoice(
        invoice_type=invoice.invoice_type,
        invoice_no=invoice.invoice_no,
        account_id=invoice.account_id,
        issue_date=invoice.issue_date or datetime.now(),
        due_date=invoice.due_date,
        status="Draft"
    )
    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)

    for item in invoice.items:
        line_total = item.quantity * item.unit_price
        vat_amount = line_total * (item.vat_rate / 100)
        total_with_vat = line_total + vat_amount
        
        subtotal += line_total
        total_vat += vat_amount
        
        db_item = models.InvoiceItem(
            invoice_id=db_invoice.id,
            product_id=item.product_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            vat_rate=item.vat_rate,
            line_total=line_total,
            vat_amount=vat_amount,
            total_with_vat=total_with_vat
        )
        db.add(db_item)
    
    db_invoice.subtotal = subtotal
    db_invoice.vat_amount = total_vat
    db_invoice.total_amount = subtotal + total_vat
    db_invoice.status = "Created"
    
    # Create accounting transaction
    account = db.query(models.Account).filter(models.Account.id == invoice.account_id).first()
    
    if invoice.invoice_type == schemas.InvoiceType.SALES:
        # Satış Faturası: Müşteri borçlandı (alacak arttı)
        transaction = models.Transaction(
            account_id=invoice.account_id,
            invoice_id=db_invoice.id,
            transaction_type=models.TransactionType.SALES_INVOICE,
            debit=db_invoice.total_amount,
            credit=0,
            date=datetime.now(),
            description=f"Satış Faturası #{db_invoice.invoice_no or db_invoice.id}"
        )
        account.receivable_balance += db_invoice.total_amount
    else:
        # Alış (Gider) Faturası: Tedarikçiye borçlandık (borç arttı)
        transaction = models.Transaction(
            account_id=invoice.account_id,
            invoice_id=db_invoice.id,
            transaction_type=models.TransactionType.PURCHASE_INVOICE,
            debit=0,
            credit=db_invoice.total_amount,
            date=datetime.now(),
            description=f"Alış Faturası #{db_invoice.invoice_no or db_invoice.id}"
        )
        account.payable_balance += db_invoice.total_amount
    
    db.add(transaction)
    db.commit()
    db.refresh(db_invoice)
    return db_invoice

@router.get("/invoices", response_model=List[schemas.Invoice])
def read_invoices(
    invoice_type: str = None,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    query = db.query(models.Invoice)
    if invoice_type:
        query = query.filter(models.Invoice.invoice_type == invoice_type)
    invoices = query.order_by(models.Invoice.issue_date.desc()).offset(skip).limit(limit).all()
    return invoices

@router.post("/transactions", response_model=schemas.Transaction)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    """Tahsilat veya Ödeme kaydı"""
    account = db.query(models.Account).filter(models.Account.id == transaction.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    db_transaction = models.Transaction(
        account_id=transaction.account_id,
        invoice_id=transaction.invoice_id,
        transaction_type=transaction.transaction_type,
        debit=transaction.debit,
        credit=transaction.credit,
        date=transaction.date or datetime.now(),
        description=transaction.description
    )
    
    # Update account balances
    if transaction.transaction_type == schemas.TransactionType.COLLECTION:
        # Tahsilat: Müşteriden para alındı (alacak azaldı)
        account.receivable_balance -= transaction.credit
    elif transaction.transaction_type == schemas.TransactionType.PAYMENT:
        # Ödeme: Tedarikçiye para verildi (borç azaldı)
        account.payable_balance -= transaction.debit
    
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@router.get("/transactions", response_model=List[schemas.Transaction])
def read_transactions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    transactions = db.query(models.Transaction).order_by(
        models.Transaction.date.desc()
    ).offset(skip).limit(limit).all()
    return transactions

@router.get("/dashboard", response_model=schemas.DashboardKPIs)
def get_dashboard_kpis(db: Session = Depends(get_db)):
    # Toplam Alacak (Müşterilerden)
    total_receivables = db.query(func.sum(models.Account.receivable_balance)).scalar() or 0.0
    
    # Toplam Borç (Tedarikçilere)
    total_payables = db.query(func.sum(models.Account.payable_balance)).scalar() or 0.0
    
    # Aylık Satış (Sales Invoices)
    monthly_sales = db.query(func.sum(models.Invoice.total_amount)).filter(
        models.Invoice.invoice_type == models.InvoiceType.SALES
    ).scalar() or 0.0
    
    # Aylık Gider (Purchase Invoices)
    monthly_expenses = db.query(func.sum(models.Invoice.total_amount)).filter(
        models.Invoice.invoice_type == models.InvoiceType.PURCHASE
    ).scalar() or 0.0
    
    # Net Bakiye
    net_balance = total_receivables - total_payables
    
    # Lead Conversion Rate
    total_deals = db.query(func.count(models.Deal.id)).scalar() or 1
    won_deals = db.query(func.count(models.Deal.id)).filter(
        models.Deal.status == models.DealStatus.INVOICED
    ).scalar() or 0
    
    rate = (won_deals / total_deals) * 100 if total_deals > 0 else 0

    return schemas.DashboardKPIs(
        total_receivables=total_receivables,
        total_payables=total_payables,
        monthly_sales=monthly_sales,
        monthly_expenses=monthly_expenses,
        net_balance=net_balance,
        lead_conversion_rate=rate
    )
