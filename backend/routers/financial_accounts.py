"""
Financial Accounts Router - Kasa ve Banka Yönetimi
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime
from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/financial-accounts",
    tags=["financial-accounts"],
    responses={404: {"description": "Not found"}},
)


@router.post("/", response_model=schemas.FinancialAccount)
def create_financial_account(
    account: schemas.FinancialAccountCreate,
    db: Session = Depends(get_db)
):
    """Yeni kasa/banka hesabı oluştur"""
    db_account = models.FinancialAccount(
        name=account.name,
        account_type=account.account_type,
        currency=account.currency,
        balance=account.initial_balance,
        description=account.description,
        is_active=True
    )
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account


@router.get("/", response_model=List[schemas.FinancialAccount])
def read_financial_accounts(
    account_type: str = None,
    is_active: bool = True,
    db: Session = Depends(get_db)
):
    """Kasa/Banka hesaplarını listele"""
    query = db.query(models.FinancialAccount)
    if account_type:
        query = query.filter(models.FinancialAccount.account_type == account_type)
    if is_active is not None:
        query = query.filter(models.FinancialAccount.is_active == is_active)
    return query.all()


@router.get("/summary")
def get_financial_summary(db: Session = Depends(get_db)):
    """Toplam kasa ve banka bakiyeleri"""
    total_cash = db.query(func.sum(models.FinancialAccount.balance)).filter(
        models.FinancialAccount.account_type == models.FinancialAccountType.CASH,
        models.FinancialAccount.is_active == True
    ).scalar() or 0.0
    
    total_bank = db.query(func.sum(models.FinancialAccount.balance)).filter(
        models.FinancialAccount.account_type == models.FinancialAccountType.BANK,
        models.FinancialAccount.is_active == True
    ).scalar() or 0.0
    
    return {
        "total_cash": total_cash,
        "total_bank": total_bank,
        "total_balance": total_cash + total_bank
    }


@router.get("/{account_id}", response_model=schemas.FinancialAccount)
def read_financial_account(account_id: int, db: Session = Depends(get_db)):
    """Hesap detayını getir"""
    db_account = db.query(models.FinancialAccount).filter(
        models.FinancialAccount.id == account_id
    ).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Financial account not found")
    return db_account


@router.put("/{account_id}", response_model=schemas.FinancialAccount)
def update_financial_account(
    account_id: int,
    account: schemas.FinancialAccountUpdate,
    db: Session = Depends(get_db)
):
    """Hesap güncelle"""
    db_account = db.query(models.FinancialAccount).filter(
        models.FinancialAccount.id == account_id
    ).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Financial account not found")
    
    if account.name is not None:
        db_account.name = account.name
    if account.description is not None:
        db_account.description = account.description
    if account.is_active is not None:
        db_account.is_active = account.is_active
    
    db.commit()
    db.refresh(db_account)
    return db_account


@router.post("/transfer")
def transfer_between_accounts(
    transfer: schemas.TransferRequest,
    db: Session = Depends(get_db)
):
    """Hesaplar arası virman"""
    # Get source account
    source = db.query(models.FinancialAccount).filter(
        models.FinancialAccount.id == transfer.source_account_id
    ).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source account not found")
    
    # Get destination account
    destination = db.query(models.FinancialAccount).filter(
        models.FinancialAccount.id == transfer.destination_account_id
    ).first()
    if not destination:
        raise HTTPException(status_code=404, detail="Destination account not found")
    
    # Check balance
    if source.balance < transfer.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Update balances
    source.balance -= transfer.amount
    destination.balance += transfer.amount
    
    # Create transaction record
    db_transaction = models.Transaction(
        transaction_type=models.TransactionType.TRANSFER,
        source_financial_account_id=source.id,
        destination_financial_account_id=destination.id,
        debit=transfer.amount,
        credit=transfer.amount,
        date=datetime.now(),
        description=transfer.description or f"Virman: {source.name} -> {destination.name}"
    )
    db.add(db_transaction)
    
    db.commit()
    
    return {
        "message": "Transfer successful",
        "source_balance": source.balance,
        "destination_balance": destination.balance
    }


@router.post("/{account_id}/deposit")
def deposit_to_account(
    account_id: int,
    amount: float,
    description: str = None,
    db: Session = Depends(get_db)
):
    """Hesaba para girişi"""
    db_account = db.query(models.FinancialAccount).filter(
        models.FinancialAccount.id == account_id
    ).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Financial account not found")
    
    db_account.balance += amount
    
    # Create transaction record
    db_transaction = models.Transaction(
        transaction_type=models.TransactionType.COLLECTION,
        destination_financial_account_id=account_id,
        credit=amount,
        date=datetime.now(),
        description=description or f"Para Girişi: {db_account.name}"
    )
    db.add(db_transaction)
    
    db.commit()
    db.refresh(db_account)
    
    return {"message": "Deposit successful", "new_balance": db_account.balance}


@router.post("/{account_id}/withdraw")
def withdraw_from_account(
    account_id: int,
    amount: float,
    description: str = None,
    db: Session = Depends(get_db)
):
    """Hesaptan para çıkışı"""
    db_account = db.query(models.FinancialAccount).filter(
        models.FinancialAccount.id == account_id
    ).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Financial account not found")
    
    if db_account.balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    db_account.balance -= amount
    
    # Create transaction record
    db_transaction = models.Transaction(
        transaction_type=models.TransactionType.PAYMENT,
        source_financial_account_id=account_id,
        debit=amount,
        date=datetime.now(),
        description=description or f"Para Çıkışı: {db_account.name}"
    )
    db.add(db_transaction)
    
    db.commit()
    db.refresh(db_account)
    
    return {"message": "Withdrawal successful", "new_balance": db_account.balance}
