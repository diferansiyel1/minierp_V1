"""
Contacts Router - CRM İletişim Kişileri
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/contacts",
    tags=["contacts"],
    responses={404: {"description": "Not found"}},
)


@router.post("/", response_model=schemas.Contact)
def create_contact(contact: schemas.ContactCreate, db: Session = Depends(get_db)):
    """Yeni iletişim kişisi oluştur"""
    # Verify account exists
    account = db.query(models.Account).filter(
        models.Account.id == contact.account_id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    db_contact = models.Contact(
        account_id=contact.account_id,
        first_name=contact.first_name,
        last_name=contact.last_name,
        email=contact.email,
        phone=contact.phone,
        role=contact.role,
        is_primary=contact.is_primary
    )
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return db_contact


@router.get("/", response_model=List[schemas.Contact])
def read_contacts(
    account_id: int = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """İletişim kişilerini listele"""
    query = db.query(models.Contact)
    if account_id:
        query = query.filter(models.Contact.account_id == account_id)
    return query.offset(skip).limit(limit).all()


@router.get("/{contact_id}", response_model=schemas.Contact)
def read_contact(contact_id: int, db: Session = Depends(get_db)):
    """İletişim kişisi detayı"""
    db_contact = db.query(models.Contact).filter(
        models.Contact.id == contact_id
    ).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return db_contact


@router.put("/{contact_id}", response_model=schemas.Contact)
def update_contact(
    contact_id: int,
    contact: schemas.ContactUpdate,
    db: Session = Depends(get_db)
):
    """İletişim kişisi güncelle"""
    db_contact = db.query(models.Contact).filter(
        models.Contact.id == contact_id
    ).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    if contact.first_name is not None:
        db_contact.first_name = contact.first_name
    if contact.last_name is not None:
        db_contact.last_name = contact.last_name
    if contact.email is not None:
        db_contact.email = contact.email
    if contact.phone is not None:
        db_contact.phone = contact.phone
    if contact.role is not None:
        db_contact.role = contact.role
    if contact.is_primary is not None:
        db_contact.is_primary = contact.is_primary
    
    db.commit()
    db.refresh(db_contact)
    return db_contact


@router.delete("/{contact_id}")
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    """İletişim kişisi sil"""
    db_contact = db.query(models.Contact).filter(
        models.Contact.id == contact_id
    ).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    db.delete(db_contact)
    db.commit()
    return {"message": "Contact deleted"}
