from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime
from .. import models, schemas
from ..database import get_db
from ..services.invoice_parser import parse_invoice_pdf
from ..services.invoice_service import update_stock, find_or_create_product

router = APIRouter(
    prefix="/finance",
    tags=["finance"],
    responses={404: {"description": "Not found"}},
)


@router.post("/invoices/parse", response_model=schemas.ParsedInvoice)
async def parse_uploaded_invoice(file: UploadFile = File(...)):
    """
    PDF fatura dosyasını analiz et ve yapılandırılmış veri çıkar.
    
    Desteklenen heuristics:
    - ETTN (UUID) çıkarma
    - Fatura tarihi tespiti
    - Toplam tutar ve KDV çıkarma
    - Tedarikçi/Alıcı tespiti
    - Proje kodu çıkarma
    - Teknokent gideri tespiti
    - KDV istisnası kontrolü
    """
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Sadece PDF dosyaları kabul edilmektedir"
        )
    
    try:
        result = await parse_invoice_pdf(file)
        return schemas.ParsedInvoice(**result)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"PDF analiz hatası: {str(e)}"
        )


@router.post("/invoices", response_model=schemas.Invoice)
def create_invoice(invoice: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    """Fatura oluştur - Satır Bazlı KDV İstisna Destekli"""
    # Get project to check for technopark auto-exemption
    project = None
    is_technopark = False
    if invoice.project_id:
        project = db.query(models.Project).filter(
            models.Project.id == invoice.project_id
        ).first()
        is_technopark = project and project.is_technopark_project
    
    # Initialize totals
    subtotal = 0.0
    total_vat = 0.0
    total_withholding = 0.0
    exempt_amount = 0.0      # KDV'siz matrah
    taxable_amount = 0.0     # KDV'li matrah
    
    # Get account for kuluçka discount automation
    account = db.query(models.Account).filter(models.Account.id == invoice.account_id).first()
    
    # Kuluçka İndirimi Otomasyonu
    discount_type = invoice.discount_type
    discount_amount = invoice.discount_amount
    
    if invoice.invoice_type == schemas.InvoiceType.PURCHASE:
        # Check for Teknokent rent discount
        if (invoice.expense_category and 
            invoice.expense_category.value == "Kira" and 
            account and "teknokent" in account.title.lower()):
            discount_type = models.DiscountType.TECHNOPARK_RENT
    
    db_invoice = models.Invoice(
        invoice_type=invoice.invoice_type,
        invoice_no=invoice.invoice_no,
        account_id=invoice.account_id,
        project_id=invoice.project_id,
        currency=invoice.currency,
        issue_date=invoice.issue_date or datetime.now(),
        due_date=invoice.due_date,
        status="Draft",
        payment_status=models.PaymentStatus.UNPAID,
        paid_amount=0.0,
        discount_type=discount_type.value if discount_type else None,
        discount_amount=discount_amount,
        expense_category=invoice.expense_category.value if invoice.expense_category else None,
        is_project_expense=invoice.is_project_expense,
        notes=invoice.notes
    )
    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)

    for item in invoice.items:
        # Get product for auto-exemption check
        product = None
        product_id = item.product_id
        
        # If no product_id but has description, try to find or create product
        if not product_id and item.description:
            found_product, is_new = find_or_create_product(
                db=db,
                description=item.description,
                unit_price=item.unit_price,
                vat_rate=item.vat_rate
            )
            if found_product:
                product = found_product
                product_id = found_product.id
        elif product_id:
            product = db.query(models.Product).filter(
                models.Product.id == product_id
            ).first()
        
        # Satır bazlı istisna belirleme
        is_exempt = item.is_exempt
        exemption_code = item.exemption_code
        original_vat_rate = item.vat_rate
        
        # Otomasyon: Teknokent + Yazılım = Muaf (kullanıcı geçersiz kılabilir)
        if is_technopark and product and product.is_software_product:
            if not item.is_exempt:  # Kullanıcı manuel olarak seçmemişse otomatik seç
                is_exempt = True
                exemption_code = "3065 G.20/1"
        
        line_total = item.quantity * item.unit_price
        
        # KDV hesaplama - satır bazlı
        if is_exempt:
            actual_vat_rate = 0
            vat_amount = 0.0
            exempt_amount += line_total
        else:
            actual_vat_rate = item.vat_rate
            vat_amount = line_total * (actual_vat_rate / 100)
            taxable_amount += line_total
        
        withholding_amount = vat_amount * item.withholding_rate if item.withholding_rate else 0.0
        total_with_vat = line_total + vat_amount - withholding_amount
        
        subtotal += line_total
        total_vat += vat_amount
        total_withholding += withholding_amount
        
        db_item = models.InvoiceItem(
            invoice_id=db_invoice.id,
            product_id=product_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            vat_rate=actual_vat_rate,
            withholding_rate=item.withholding_rate,
            line_total=line_total,
            vat_amount=vat_amount,
            withholding_amount=withholding_amount,
            total_with_vat=total_with_vat,
            is_exempt=is_exempt,
            exemption_code=exemption_code,
            original_vat_rate=original_vat_rate
        )
        db.add(db_item)
        
        # Update stock quantity for goods products
        if product_id:
            update_stock(
                db=db,
                product_id=product_id,
                quantity=item.quantity,
                invoice_type=invoice.invoice_type.value
            )
    
    # Set invoice totals
    db_invoice.subtotal = subtotal
    db_invoice.vat_amount = total_vat
    db_invoice.withholding_amount = total_withholding
    db_invoice.total_amount = subtotal + total_vat - total_withholding
    db_invoice.exempt_amount = exempt_amount
    db_invoice.taxable_amount = taxable_amount
    db_invoice.status = "Created"
    
    # Create accounting transaction
    account = db.query(models.Account).filter(models.Account.id == invoice.account_id).first()
    
    if invoice.invoice_type == schemas.InvoiceType.SALES:
        # Satış Faturası: Müşteri borçlandı (alacak arttı)
        transaction = models.Transaction(
            account_id=invoice.account_id,
            invoice_id=db_invoice.id,
            project_id=invoice.project_id,
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
            project_id=invoice.project_id,
            transaction_type=models.TransactionType.PURCHASE_INVOICE,
            debit=0,
            credit=db_invoice.total_amount,
            date=datetime.now(),
            description=f"Alış Faturası #{db_invoice.invoice_no or db_invoice.id}"
        )
        account.payable_balance += db_invoice.total_amount
    
    db.add(transaction)
    
    # Project budget tracking for expense invoices
    if (invoice.invoice_type == schemas.InvoiceType.PURCHASE and 
        invoice.is_project_expense and invoice.project_id):
        project = db.query(models.Project).filter(
            models.Project.id == invoice.project_id
        ).first()
        if project:
            project.spent_budget += db_invoice.total_amount
    
    db.commit()
    db.refresh(db_invoice)
    return db_invoice


@router.post("/invoices/{invoice_id}/payment", response_model=schemas.Transaction)
def register_payment(
    invoice_id: int,
    payment: schemas.PaymentRequest,
    db: Session = Depends(get_db)
):
    """
    Fatura ödemesi/tahsilatı kaydet.
    
    İş Mantığı:
    1. Faturayı bul ve doğrula
    2. paid_amount'u artır
    3. payment_status'u güncelle (PARTIAL veya PAID)
    4. Transaction kaydı oluştur (Collection veya Payment)
    5. Kasa/Banka bakiyesini güncelle
    6. Cari hesap bakiyesini güncelle
    """
    # 1. Faturayı bul
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id
    ).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Fatura bulunamadı")
    
    # Fatura hesabını al
    account = db.query(models.Account).filter(
        models.Account.id == invoice.account_id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Cari hesap bulunamadı")
    
    # Finansal hesabı (Kasa/Banka) al
    financial_account = db.query(models.FinancialAccount).filter(
        models.FinancialAccount.id == payment.financial_account_id
    ).first()
    
    if not financial_account:
        raise HTTPException(status_code=404, detail="Kasa/Banka hesabı bulunamadı")
    
    if not financial_account.is_active:
        raise HTTPException(status_code=400, detail="Seçilen hesap aktif değil")
    
    # Ödeme tutarı doğrulama
    remaining_amount = invoice.total_amount - invoice.paid_amount
    if payment.amount <= 0:
        raise HTTPException(status_code=400, detail="Ödeme tutarı 0'dan büyük olmalıdır")
    
    if payment.amount > remaining_amount:
        raise HTTPException(
            status_code=400, 
            detail=f"Ödeme tutarı kalan bakiyeyi aşamaz. Kalan: {remaining_amount:.2f}"
        )
    
    # 2. paid_amount'u artır
    invoice.paid_amount += payment.amount
    
    # 3. payment_status'u güncelle
    if invoice.paid_amount >= invoice.total_amount:
        invoice.payment_status = models.PaymentStatus.PAID
    else:
        invoice.payment_status = models.PaymentStatus.PARTIAL
    
    # 4. Transaction kaydı oluştur
    payment_date = payment.date or datetime.now()
    
    if invoice.invoice_type == models.InvoiceType.SALES.value:
        # Satış Faturası Tahsilatı: Müşteriden para alındı
        # Kasa/Bankaya para girişi (+)
        # Müşteri alacağı azaldı (receivable_balance -)
        transaction = models.Transaction(
            account_id=invoice.account_id,
            invoice_id=invoice.id,
            project_id=invoice.project_id,
            source_financial_account_id=None,
            destination_financial_account_id=payment.financial_account_id,
            transaction_type=models.TransactionType.COLLECTION.value,
            debit=0,
            credit=payment.amount,
            date=payment_date,
            description=payment.description or f"Fatura #{invoice.invoice_no or invoice.id} tahsilatı"
        )
        
        # 5. Kasa/Banka bakiyesini artır (para girişi)
        financial_account.balance += payment.amount
        
        # 6. Müşteri alacak bakiyesini azalt
        account.receivable_balance -= payment.amount
        
    else:
        # Alış (Gider) Faturası Ödemesi: Tedarikçiye para verildi
        # Kasa/Bankadan para çıkışı (-)
        # Tedarikçi borcumuz azaldı (payable_balance -)
        
        # Yeterli bakiye kontrolü
        if financial_account.balance < payment.amount:
            raise HTTPException(
                status_code=400,
                detail=f"Yetersiz bakiye. Mevcut: {financial_account.balance:.2f}"
            )
        
        transaction = models.Transaction(
            account_id=invoice.account_id,
            invoice_id=invoice.id,
            project_id=invoice.project_id,
            source_financial_account_id=payment.financial_account_id,
            destination_financial_account_id=None,
            transaction_type=models.TransactionType.PAYMENT.value,
            debit=payment.amount,
            credit=0,
            date=payment_date,
            description=payment.description or f"Fatura #{invoice.invoice_no or invoice.id} ödemesi"
        )
        
        # 5. Kasa/Banka bakiyesini azalt (para çıkışı)
        financial_account.balance -= payment.amount
        
        # 6. Tedarikçi borç bakiyesini azalt
        account.payable_balance -= payment.amount
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    return transaction


@router.get("/invoices", response_model=List[schemas.Invoice])
def read_invoices(
    invoice_type: str = None,
    payment_status: str = None,
    project_id: int = None,
    start_date: str = None,
    end_date: str = None,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    """Fatura listesi - Gelişmiş filtrelerle"""
    query = db.query(models.Invoice)
    
    if invoice_type:
        query = query.filter(models.Invoice.invoice_type == invoice_type)
    
    if payment_status:
        query = query.filter(models.Invoice.payment_status == payment_status)
    
    if project_id:
        query = query.filter(models.Invoice.project_id == project_id)
    
    if start_date:
        from datetime import datetime as dt
        try:
            start = dt.fromisoformat(start_date.replace('Z', '+00:00'))
            query = query.filter(models.Invoice.issue_date >= start)
        except ValueError:
            pass
    
    if end_date:
        from datetime import datetime as dt
        try:
            end = dt.fromisoformat(end_date.replace('Z', '+00:00'))
            query = query.filter(models.Invoice.issue_date <= end)
        except ValueError:
            pass
    
    invoices = query.order_by(models.Invoice.issue_date.desc()).offset(skip).limit(limit).all()
    return invoices


@router.delete("/invoices/{invoice_id}")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """Fatura sil - İlişkili kayıtlarla birlikte"""
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Fatura bulunamadı")
    
    # Check if there are any payments made
    if invoice.paid_amount and invoice.paid_amount > 0:
        raise HTTPException(
            status_code=400, 
            detail="Ödemesi yapılmış fatura silinemez. Önce ödemeleri iptal edin."
        )
    
    # Delete related invoice items
    db.query(models.InvoiceItem).filter(
        models.InvoiceItem.invoice_id == invoice_id
    ).delete()
    
    # Delete related transactions
    db.query(models.Transaction).filter(
        models.Transaction.invoice_id == invoice_id
    ).delete()
    
    # Reverse account balance changes
    account = db.query(models.Account).filter(models.Account.id == invoice.account_id).first()
    if account:
        if invoice.invoice_type == "Sales":
            account.receivable_balance -= invoice.total_amount
        else:
            account.payable_balance -= invoice.total_amount
    
    # Delete the invoice
    db.delete(invoice)
    db.commit()
    
    return {"message": "Fatura başarıyla silindi", "id": invoice_id}
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
    
    # Toplam Kasa/Banka Bakiyesi
    total_cash_balance = db.query(func.sum(models.FinancialAccount.balance)).filter(
        models.FinancialAccount.is_active == True
    ).scalar() or 0.0
    
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
        lead_conversion_rate=rate,
        total_cash_balance=total_cash_balance
    )


@router.get("/charts/income-expense")
def get_income_expense_chart(
    period: str = "monthly",
    year: int = None,
    db: Session = Depends(get_db)
):
    """Gelir/Gider grafik verileri - Aylık, Çeyreklik veya Yıllık"""
    from datetime import datetime as dt
    from sqlalchemy import extract
    
    current_year = year or dt.now().year
    
    if period == "monthly":
        # Son 12 ay
        data = []
        month_names = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 
                      'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
        
        for month in range(1, 13):
            income = db.query(func.sum(models.Invoice.total_amount)).filter(
                models.Invoice.invoice_type == models.InvoiceType.SALES,
                extract('month', models.Invoice.issue_date) == month,
                extract('year', models.Invoice.issue_date) == current_year
            ).scalar() or 0.0
            
            expense = db.query(func.sum(models.Invoice.total_amount)).filter(
                models.Invoice.invoice_type == models.InvoiceType.PURCHASE,
                extract('month', models.Invoice.issue_date) == month,
                extract('year', models.Invoice.issue_date) == current_year
            ).scalar() or 0.0
            
            data.append({
                "name": month_names[month-1],
                "month": month,
                "income": float(income),
                "expense": float(expense),
                "profit": float(income - expense)
            })
        
        return {"period": "monthly", "year": current_year, "data": data}
    
    elif period == "quarterly":
        # 4 Çeyrek
        data = []
        quarter_names = ['Q1', 'Q2', 'Q3', 'Q4']
        quarter_months = [(1, 3), (4, 6), (7, 9), (10, 12)]
        
        for i, (start_month, end_month) in enumerate(quarter_months):
            income = db.query(func.sum(models.Invoice.total_amount)).filter(
                models.Invoice.invoice_type == models.InvoiceType.SALES,
                extract('month', models.Invoice.issue_date) >= start_month,
                extract('month', models.Invoice.issue_date) <= end_month,
                extract('year', models.Invoice.issue_date) == current_year
            ).scalar() or 0.0
            
            expense = db.query(func.sum(models.Invoice.total_amount)).filter(
                models.Invoice.invoice_type == models.InvoiceType.PURCHASE,
                extract('month', models.Invoice.issue_date) >= start_month,
                extract('month', models.Invoice.issue_date) <= end_month,
                extract('year', models.Invoice.issue_date) == current_year
            ).scalar() or 0.0
            
            data.append({
                "name": quarter_names[i],
                "quarter": i + 1,
                "income": float(income),
                "expense": float(expense),
                "profit": float(income - expense)
            })
        
        return {"period": "quarterly", "year": current_year, "data": data}
    
    else:  # yearly
        # Son 5 yıl
        data = []
        for y in range(current_year - 4, current_year + 1):
            income = db.query(func.sum(models.Invoice.total_amount)).filter(
                models.Invoice.invoice_type == models.InvoiceType.SALES,
                extract('year', models.Invoice.issue_date) == y
            ).scalar() or 0.0
            
            expense = db.query(func.sum(models.Invoice.total_amount)).filter(
                models.Invoice.invoice_type == models.InvoiceType.PURCHASE,
                extract('year', models.Invoice.issue_date) == y
            ).scalar() or 0.0
            
            data.append({
                "name": str(y),
                "year": y,
                "income": float(income),
                "expense": float(expense),
                "profit": float(income - expense)
            })
        
        return {"period": "yearly", "data": data}


@router.get("/charts/projects")
def get_project_chart(db: Session = Depends(get_db)):
    """Proje bazlı gelir/gider grafiği"""
    projects = db.query(models.Project).order_by(models.Project.created_at.desc()).limit(10).all()
    
    data = []
    for project in projects:
        income = db.query(func.sum(models.Invoice.total_amount)).filter(
            models.Invoice.project_id == project.id,
            models.Invoice.invoice_type == models.InvoiceType.SALES
        ).scalar() or 0.0
        
        expense = db.query(func.sum(models.Invoice.total_amount)).filter(
            models.Invoice.project_id == project.id,
            models.Invoice.invoice_type == models.InvoiceType.PURCHASE
        ).scalar() or 0.0
        
        data.append({
            "name": project.code,
            "project_name": project.name,
            "income": float(income),
            "expense": float(expense),
            "profit": float(income - expense),
            "budget": float(project.budget)
        })
    
    return {"data": data}
