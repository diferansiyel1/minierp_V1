from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from .. import models, schemas
from ..database import get_db
from .auth import get_current_active_user
from ..services.technopark_report_service import get_technopark_report_service

router = APIRouter(
    prefix="/technopark-reports",
    tags=["technopark-reports"],
)


@router.get("/", response_model=List[schemas.TechnoparkReport])
def list_reports(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    query = db.query(models.TechnoparkReport).filter(
        models.TechnoparkReport.tenant_id == current_user.tenant_id
    )
    if year:
        query = query.filter(models.TechnoparkReport.year == year)
    if month:
        query = query.filter(models.TechnoparkReport.month == month)
    return query.order_by(models.TechnoparkReport.year.desc(), models.TechnoparkReport.month.desc()).all()


@router.get("/auto-fill", response_model=schemas.TechnoparkReportCreate)
def get_autofill_payload(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    if not 1 <= month <= 12:
        raise HTTPException(status_code=400, detail="Ay 1-12 arasında olmalıdır")
    service = get_technopark_report_service(db)
    return service.build_autofill_payload(current_user.tenant_id, year, month)


@router.post("/upsert", response_model=schemas.TechnoparkReport)
def upsert_report(
    payload: schemas.TechnoparkReportCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    service = get_technopark_report_service(db)
    return service.upsert_report(current_user.tenant_id, payload)


@router.get("/{report_id}", response_model=schemas.TechnoparkReport)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    report = db.query(models.TechnoparkReport).filter(
        models.TechnoparkReport.id == report_id,
        models.TechnoparkReport.tenant_id == current_user.tenant_id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Rapor bulunamadı")
    return report


@router.patch("/{report_id}", response_model=schemas.TechnoparkReport)
def update_report(
    report_id: int,
    payload: schemas.TechnoparkReportUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    report = db.query(models.TechnoparkReport).filter(
        models.TechnoparkReport.id == report_id,
        models.TechnoparkReport.tenant_id == current_user.tenant_id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Rapor bulunamadı")

    service = get_technopark_report_service(db)
    return service.update_report(report_id, payload)


@router.get("/{report_id}/download")
def download_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    report = db.query(models.TechnoparkReport).filter(
        models.TechnoparkReport.id == report_id,
        models.TechnoparkReport.tenant_id == current_user.tenant_id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Rapor bulunamadı")

    service = get_technopark_report_service(db)
    result = service.generate_official_pdf(report_id)

    return StreamingResponse(
        result["buffer"],
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={result['filename']}"},
    )
