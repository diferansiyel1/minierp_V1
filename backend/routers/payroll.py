from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List

from .. import schemas, models
from ..database import get_db
from ..services.payroll_service import get_payroll_service
from ..services.reporting_service import get_reporting_service
from .auth import get_current_active_user

router = APIRouter(
    prefix="/payroll",
    tags=["payroll"],
    responses={404: {"description": "Not found"}},
)


@router.get("/employees", response_model=List[schemas.EmployeeResponse])
def list_employees(
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    service = get_payroll_service(db)
    return service.list_employees(current_user.tenant_id, active_only=active_only)


@router.post("/employees", response_model=schemas.EmployeeResponse)
def create_employee(
    payload: schemas.EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    service = get_payroll_service(db)
    return service.create_employee(payload, current_user.tenant_id)


@router.put("/employees/{employee_id}", response_model=schemas.EmployeeResponse)
def update_employee(
    employee_id: int,
    payload: schemas.EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    service = get_payroll_service(db)
    return service.update_employee(employee_id, payload, current_user.tenant_id)


@router.get("/periods", response_model=List[schemas.PayrollPeriodResponse])
def list_periods(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    service = get_payroll_service(db)
    return service.list_periods(current_user.tenant_id)


@router.post("/periods", response_model=schemas.PayrollPeriodResponse)
def create_period(
    payload: schemas.PayrollPeriodCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    service = get_payroll_service(db)
    return service.create_period(payload, current_user.tenant_id)


@router.get("/periods/{period_id}/entries", response_model=List[schemas.PayrollEntryResponse])
def list_period_entries(
    period_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    service = get_payroll_service(db)
    return service.list_entries(period_id, current_user.tenant_id)


@router.post("/periods/{period_id}/process", response_model=List[schemas.PayrollEntryResponse])
def process_period(
    period_id: int,
    payload: schemas.PayrollProcessRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    service = get_payroll_service(db)
    return service.process_payroll_period(period_id, payload.entries, current_user.tenant_id)


@router.get("/periods/{period_id}/summary", response_model=schemas.PayrollSummaryResponse)
def get_period_summary(
    period_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    service = get_payroll_service(db)
    return service.get_payroll_summary(period_id, current_user.tenant_id)


@router.get("/periods/{period_id}/technopark-personnel-report")
def generate_personnel_report(
    period_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    reporting_service = get_reporting_service(db)
    try:
        pdf_buffer = reporting_service.generate_technopark_personnel_report(
            tenant_id=current_user.tenant_id,
            period_id=period_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    filename = "Teknokent_Personel_Bildirim_Listesi.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
