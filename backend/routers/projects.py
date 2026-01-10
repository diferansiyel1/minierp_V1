"""
Projects Router - Ar-Ge Proje Yönetimi
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime
from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/projects",
    tags=["projects"],
    responses={404: {"description": "Not found"}},
)


@router.post("/", response_model=schemas.Project)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    """Yeni Ar-Ge projesi oluştur"""
    # Check if code exists
    existing = db.query(models.Project).filter(
        models.Project.code == project.code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Project code already exists")
    
    db_project = models.Project(
        name=project.name,
        code=project.code,
        description=project.description,
        start_date=project.start_date,
        end_date=project.end_date,
        status=project.status,
        budget=project.budget
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@router.get("/", response_model=List[schemas.Project])
def read_projects(
    status: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Projeleri listele"""
    query = db.query(models.Project)
    if status:
        query = query.filter(models.Project.status == status)
    projects = query.order_by(models.Project.created_at.desc()).offset(skip).limit(limit).all()
    return projects


@router.get("/{project_id}", response_model=schemas.Project)
def read_project(project_id: int, db: Session = Depends(get_db)):
    """Proje detayını getir"""
    db_project = db.query(models.Project).filter(
        models.Project.id == project_id
    ).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db_project


@router.put("/{project_id}", response_model=schemas.Project)
def update_project(
    project_id: int,
    project: schemas.ProjectUpdate,
    db: Session = Depends(get_db)
):
    """Proje güncelle"""
    db_project = db.query(models.Project).filter(
        models.Project.id == project_id
    ).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.name is not None:
        db_project.name = project.name
    if project.description is not None:
        db_project.description = project.description
    if project.start_date is not None:
        db_project.start_date = project.start_date
    if project.end_date is not None:
        db_project.end_date = project.end_date
    if project.status is not None:
        db_project.status = project.status
    if project.budget is not None:
        db_project.budget = project.budget
    
    db.commit()
    db.refresh(db_project)
    return db_project


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """Proje sil"""
    db_project = db.query(models.Project).filter(
        models.Project.id == project_id
    ).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.delete(db_project)
    db.commit()
    return {"message": "Project deleted"}


@router.get("/{project_id}/summary", response_model=schemas.ProjectSummary)
def get_project_summary(project_id: int, db: Session = Depends(get_db)):
    """Proje finansal özeti"""
    db_project = db.query(models.Project).filter(
        models.Project.id == project_id
    ).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Calculate income (Sales Invoices)
    total_income = db.query(func.sum(models.Invoice.total_amount)).filter(
        models.Invoice.project_id == project_id,
        models.Invoice.invoice_type == models.InvoiceType.SALES
    ).scalar() or 0.0
    
    # Calculate expenses (Purchase Invoices)
    total_expense = db.query(func.sum(models.Invoice.total_amount)).filter(
        models.Invoice.project_id == project_id,
        models.Invoice.invoice_type == models.InvoiceType.PURCHASE
    ).scalar() or 0.0
    
    # Invoice count
    invoice_count = db.query(func.count(models.Invoice.id)).filter(
        models.Invoice.project_id == project_id
    ).scalar() or 0
    
    return schemas.ProjectSummary(
        project=db_project,
        total_income=total_income,
        total_expense=total_expense,
        profit=total_income - total_expense,
        invoice_count=invoice_count
    )
