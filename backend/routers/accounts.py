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
