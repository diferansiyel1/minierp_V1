from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/accounts",
    tags=["accounts"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=schemas.Account)
def create_account(account: schemas.AccountCreate, db: Session = Depends(get_db)):
    db_account = models.Account(**account.dict())
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account

@router.get("/", response_model=List[schemas.Account])
def read_accounts(
    skip: int = 0, 
    limit: int = 100, 
    account_type: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Account)
    if account_type:
        query = query.filter(models.Account.account_type == account_type)
    accounts = query.offset(skip).limit(limit).all()
    return accounts

@router.get("/customers", response_model=List[schemas.Account])
def read_customers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    accounts = db.query(models.Account).filter(
        models.Account.account_type.in_([models.AccountType.CUSTOMER, models.AccountType.BOTH])
    ).offset(skip).limit(limit).all()
    return accounts

@router.get("/suppliers", response_model=List[schemas.Account])
def read_suppliers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    accounts = db.query(models.Account).filter(
        models.Account.account_type.in_([models.AccountType.SUPPLIER, models.AccountType.BOTH])
    ).offset(skip).limit(limit).all()
    return accounts

@router.get("/{account_id}", response_model=schemas.Account)
def read_account(account_id: int, db: Session = Depends(get_db)):
    db_account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if db_account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return db_account

@router.put("/{account_id}", response_model=schemas.Account)
def update_account(account_id: int, account: schemas.AccountCreate, db: Session = Depends(get_db)):
    db_account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    for key, value in account.dict().items():
        setattr(db_account, key, value)
    
    db.commit()
    db.refresh(db_account)
    return db_account

@router.get("/{account_id}/ledger", response_model=List[schemas.Transaction])
def get_account_ledger(account_id: int, db: Session = Depends(get_db)):
    """Cari Ekstre - Hesap hareketleri"""
    transactions = db.query(models.Transaction).filter(
        models.Transaction.account_id == account_id
    ).order_by(models.Transaction.date.desc()).all()
    return transactions

@router.get("/{account_id}/timeline")
def get_account_timeline(account_id: int, db: Session = Depends(get_db)):
    """
    Müşteri Zaman Çizelgesi:
    - Aktiviteler (Görüşme, Not)
    - Satışlar (Won Deals)
    - Teklifler (Quotes)
    - Faturalar
    """
    events = []
    
    # 1. Activities
    activities = db.query(models.Activity).filter(models.Activity.account_id == account_id).all()
    for act in activities:
        events.append({
            "id": act.id,
            "type": act.activity_type.lower(), # call, meeting, email, note
            "title": f"{act.activity_type} - {act.summary[:30]}...",
            "description": act.summary,
            "date": act.date
        })

    # 2. Deals (Won -> Sale)
    won_deals = db.query(models.Deal).filter(
        models.Deal.account_id == account_id, 
        models.Deal.status == models.DealStatus.ORDER_RECEIVED
    ).all()
    for deal in won_deals:
        events.append({
            "id": deal.id,
            "type": "sale",
            "title": f"Satış Yapıldı: {deal.title}",
            "description": f"Tutar: {deal.estimated_value} TRY",
            "date": deal.created_at # Ideally this should be the won_at date if we tracked it, using created_at for now
        })

    # 3. Quotes
    quotes = db.query(models.Quote).filter(models.Quote.account_id == account_id).all()
    for quote in quotes:
         events.append({
            "id": quote.id,
            "type": "quote",
            "title": f"Teklif Verildi: {quote.quote_no}",
            "description": f"Tutar: {quote.total_amount} {quote.currency}",
            "date": quote.created_at
        })

    # Sort by date descending
    events.sort(key=lambda x: x['date'], reverse=True)
    return events
