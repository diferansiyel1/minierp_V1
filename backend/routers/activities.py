"""
Activities Router - CRM Aktivite/Görüşme Kayıtları
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/activities",
    tags=["activities"],
    responses={404: {"description": "Not found"}},
)


@router.post("/", response_model=schemas.Activity)
def create_activity(activity: schemas.ActivityCreate, db: Session = Depends(get_db)):
    """Yeni aktivite/görüşme kaydı oluştur"""
    db_activity = models.Activity(
        activity_type=activity.activity_type,
        summary=activity.summary,
        date=activity.date or datetime.now(),
        deal_id=activity.deal_id,
        account_id=activity.account_id,
        contact_id=activity.contact_id
    )
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return db_activity


@router.get("/", response_model=List[schemas.Activity])
def read_activities(
    deal_id: int = None,
    account_id: int = None,
    activity_type: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Aktiviteleri listele"""
    query = db.query(models.Activity)
    if deal_id:
        query = query.filter(models.Activity.deal_id == deal_id)
    if account_id:
        query = query.filter(models.Activity.account_id == account_id)
    if activity_type:
        query = query.filter(models.Activity.activity_type == activity_type)
    return query.order_by(models.Activity.date.desc()).offset(skip).limit(limit).all()


@router.get("/{activity_id}", response_model=schemas.Activity)
def read_activity(activity_id: int, db: Session = Depends(get_db)):
    """Aktivite detayı"""
    db_activity = db.query(models.Activity).filter(
        models.Activity.id == activity_id
    ).first()
    if not db_activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return db_activity


@router.delete("/{activity_id}")
def delete_activity(activity_id: int, db: Session = Depends(get_db)):
    """Aktivite sil"""
    db_activity = db.query(models.Activity).filter(
        models.Activity.id == activity_id
    ).first()
    if not db_activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    
    db.delete(db_activity)
    db.commit()
    return {"message": "Activity deleted"}
