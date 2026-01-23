"""
Teknokent Personel & Bordro Yönetimi Servisi
5746/4691 Sayılı Kanun kapsamında bordro ve teşvik hesaplamaları
"""

from typing import Dict, Any, List, Optional
import json

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas


class PayrollService:
    def __init__(self, db: Session):
        self.db = db

    def list_employees(self, tenant_id: Optional[int], active_only: bool = True) -> List[models.Employee]:
        query = self.db.query(models.Employee)
        if tenant_id is not None:
            query = query.filter(models.Employee.tenant_id == tenant_id)
        if active_only:
            query = query.filter(models.Employee.is_active == True)
        return query.order_by(models.Employee.full_name.asc()).all()

    def create_employee(self, payload: schemas.EmployeeCreate, tenant_id: Optional[int]) -> models.Employee:
        employee = models.Employee(
            tenant_id=tenant_id,
            project_id=payload.project_id,
            full_name=payload.full_name,
            tc_id_no=payload.tc_id_no,
            email=payload.email,
            is_active=payload.is_active,
            start_date=payload.start_date,
            end_date=payload.end_date,
            personnel_type=payload.personnel_type,
            education_level=payload.education_level,
            graduation_field=payload.graduation_field,
            is_student=payload.is_student,
            gross_salary=payload.gross_salary,
        )
        self.db.add(employee)
        self.db.commit()
        self.db.refresh(employee)
        return employee

    def update_employee(
        self,
        employee_id: int,
        payload: schemas.EmployeeUpdate,
        tenant_id: Optional[int],
    ) -> models.Employee:
        employee = self.db.query(models.Employee).filter(models.Employee.id == employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Personel bulunamadı")

        if tenant_id is not None and employee.tenant_id != tenant_id:
            raise HTTPException(status_code=403, detail="Bu personel için yetkiniz yok")

        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(employee, field, value)

        self.db.commit()
        self.db.refresh(employee)
        return employee

    def list_periods(self, tenant_id: Optional[int]) -> List[models.PayrollPeriod]:
        query = self.db.query(models.PayrollPeriod)
        if tenant_id is not None:
            query = query.filter(models.PayrollPeriod.tenant_id == tenant_id)
        return query.order_by(models.PayrollPeriod.year.desc(), models.PayrollPeriod.month.desc()).all()

    def create_period(self, payload: schemas.PayrollPeriodCreate, tenant_id: Optional[int]) -> models.PayrollPeriod:
        existing = self.db.query(models.PayrollPeriod).filter(
            models.PayrollPeriod.tenant_id == tenant_id,
            models.PayrollPeriod.year == payload.year,
            models.PayrollPeriod.month == payload.month,
        ).first()
        if existing:
            return existing

        period = models.PayrollPeriod(
            tenant_id=tenant_id,
            year=payload.year,
            month=payload.month,
            is_locked=payload.is_locked,
        )
        self.db.add(period)
        self.db.commit()
        self.db.refresh(period)
        return period

    def list_entries(self, period_id: int, tenant_id: Optional[int]) -> List[models.PayrollEntry]:
        period = self.db.query(models.PayrollPeriod).filter(
            models.PayrollPeriod.id == period_id
        ).first()
        if not period:
            raise HTTPException(status_code=404, detail="Bordro dönemi bulunamadı")
        if tenant_id is not None and period.tenant_id != tenant_id:
            raise HTTPException(status_code=403, detail="Bu bordro dönemine erişim yetkiniz yok")

        return self.db.query(models.PayrollEntry).filter(
            models.PayrollEntry.payroll_period_id == period.id
        ).all()

    def get_income_tax_brackets(self, year: int = 2026) -> List[Dict[str, Any]]:
        setting = self.db.query(models.SystemSetting).filter(
            models.SystemSetting.key == f"income_tax_brackets_{year}"
        ).first()

        if setting and setting.value:
            try:
                brackets = json.loads(setting.value)
                if isinstance(brackets, list):
                    return brackets
            except Exception:
                pass

        # Fallback default brackets (override via SystemSettings)
        return [
            {"limit": 110000, "rate": 0.15},
            {"limit": 230000, "rate": 0.20},
            {"limit": 580000, "rate": 0.27},
            {"limit": 3000000, "rate": 0.35},
            {"limit": None, "rate": 0.40},
        ]

    def get_exemption_rates(self, employee: models.Employee) -> Dict[str, float]:
        if employee.personnel_type not in {
            models.PersonnelType.RD_PERSONNEL,
            models.PersonnelType.SOFTWARE_PERSONNEL,
        }:
            return {
                "income_tax": 0.0,
                "stamp_tax": 0.0,
                "sgk_employer": 0.0,
            }

        income_tax = 0.0
        if employee.education_level == models.PayrollEducationLevel.PHD:
            income_tax = 0.95
        elif (
            employee.education_level == models.PayrollEducationLevel.MASTER
            and employee.graduation_field == models.GraduationField.BASIC_SCIENCES
        ):
            income_tax = 0.95
        elif employee.education_level == models.PayrollEducationLevel.MASTER:
            income_tax = 0.90
        elif (
            employee.education_level == models.PayrollEducationLevel.BACHELOR
            and employee.graduation_field == models.GraduationField.BASIC_SCIENCES
        ):
            income_tax = 0.90
        elif employee.education_level == models.PayrollEducationLevel.BACHELOR:
            income_tax = 0.80

        return {
            "income_tax": income_tax,
            "stamp_tax": 1.0,
            "sgk_employer": 0.50,
        }

    def validate_support_personnel_ratio(self, tenant_id: Optional[int]) -> None:
        query = self.db.query(models.Employee).filter(models.Employee.is_active == True)
        if tenant_id is not None:
            query = query.filter(models.Employee.tenant_id == tenant_id)

        employees = query.all()
        rd_count = sum(
            1
            for e in employees
            if e.personnel_type
            in {models.PersonnelType.RD_PERSONNEL, models.PersonnelType.SOFTWARE_PERSONNEL}
        )
        support_count = sum(1 for e in employees if e.personnel_type == models.PersonnelType.SUPPORT_PERSONNEL)

        if rd_count == 0 and support_count > 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Destek personeli sayısı, Ar-Ge personeli sayısının %10'unu geçemez. "
                    "Lütfen kadroyu kontrol edin."
                ),
            )

        if rd_count > 0 and support_count > rd_count * 0.10:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Destek personeli sayısı, Ar-Ge personeli sayısının %10'unu geçemez. "
                    "Lütfen kadroyu kontrol edin."
                ),
            )

    def calculate_progressive_tax(self, base_amount: float, brackets: List[Dict[str, Any]]) -> float:
        if base_amount <= 0:
            return 0.0

        remaining = base_amount
        total_tax = 0.0
        previous_limit = 0.0

        for bracket in brackets:
            limit = bracket.get("limit")
            rate = float(bracket.get("rate", 0.0))

            if limit is None:
                taxable = remaining
            else:
                taxable = min(remaining, max(0.0, float(limit) - previous_limit))

            total_tax += taxable * rate
            remaining -= taxable

            if remaining <= 0:
                break

            if limit is not None:
                previous_limit = float(limit)

        return total_tax

    def calculate_entry(
        self,
        employee: models.Employee,
        entry_input: schemas.PayrollEntryInput,
        brackets: List[Dict[str, Any]],
    ) -> Dict[str, float]:
        rates = self.get_exemption_rates(employee)
        gross_salary = float(employee.gross_salary or 0.0)

        sgk_worker = gross_salary * 0.14
        unemployment_worker = gross_salary * 0.01
        sgk_employer = gross_salary * 0.205
        unemployment_employer = gross_salary * 0.02

        sgk_incentive = sgk_employer * rates["sgk_employer"]

        income_tax_base = max(0.0, gross_salary - (sgk_worker + unemployment_worker))
        calculated_income_tax = self.calculate_progressive_tax(income_tax_base, brackets)
        income_tax_incentive = calculated_income_tax * rates["income_tax"]

        stamp_tax = gross_salary * 0.00759
        stamp_tax_incentive = stamp_tax * rates["stamp_tax"]

        net_salary = gross_salary - (
            sgk_worker
            + unemployment_worker
            + (calculated_income_tax - income_tax_incentive)
            + (stamp_tax - stamp_tax_incentive)
        )

        return {
            "calculated_gross": gross_salary,
            "sgk_base": gross_salary,
            "income_tax_base": income_tax_base,
            "net_salary": max(0.0, net_salary),
            "income_tax_exemption_amount": income_tax_incentive,
            "stamp_tax_exemption_amount": stamp_tax_incentive,
            "sgk_employer_incentive_amount": sgk_incentive,
        }

    def process_payroll_period(
        self,
        period_id: int,
        entries: List[schemas.PayrollEntryInput],
        tenant_id: Optional[int],
    ) -> List[models.PayrollEntry]:
        period = self.db.query(models.PayrollPeriod).filter(
            models.PayrollPeriod.id == period_id
        ).first()

        if not period:
            raise HTTPException(status_code=404, detail="Bordro dönemi bulunamadı")

        if tenant_id is not None and period.tenant_id != tenant_id:
            raise HTTPException(status_code=403, detail="Bu bordro dönemine erişim yetkiniz yok")

        if period.is_locked:
            raise HTTPException(status_code=400, detail="Bu bordro dönemi kilitli")

        self.validate_support_personnel_ratio(tenant_id)
        brackets = self.get_income_tax_brackets(period.year)

        saved_entries: List[models.PayrollEntry] = []

        for entry_input in entries:
            employee = self.db.query(models.Employee).filter(
                models.Employee.id == entry_input.employee_id
            ).first()

            if not employee:
                raise HTTPException(status_code=404, detail="Personel bulunamadı")

            if tenant_id is not None and employee.tenant_id != tenant_id:
                raise HTTPException(status_code=403, detail="Bu personel için yetkiniz yok")

            calculations = self.calculate_entry(employee, entry_input, brackets)

            entry = self.db.query(models.PayrollEntry).filter(
                models.PayrollEntry.employee_id == employee.id,
                models.PayrollEntry.payroll_period_id == period.id,
            ).first()

            if not entry:
                entry = models.PayrollEntry(
                    tenant_id=tenant_id,
                    employee_id=employee.id,
                    payroll_period_id=period.id,
                )

            entry.worked_days = entry_input.worked_days
            entry.remote_days = entry_input.remote_days
            entry.weekend_days = entry_input.weekend_days
            entry.absent_days = entry_input.absent_days

            entry.calculated_gross = calculations["calculated_gross"]
            entry.sgk_base = calculations["sgk_base"]
            entry.income_tax_base = calculations["income_tax_base"]
            entry.net_salary = calculations["net_salary"]
            entry.income_tax_exemption_amount = calculations["income_tax_exemption_amount"]
            entry.stamp_tax_exemption_amount = calculations["stamp_tax_exemption_amount"]
            entry.sgk_employer_incentive_amount = calculations["sgk_employer_incentive_amount"]

            self.db.add(entry)
            saved_entries.append(entry)

        self.db.commit()

        for entry in saved_entries:
            self.db.refresh(entry)

        return saved_entries

    def get_payroll_summary(self, period_id: int, tenant_id: Optional[int]) -> schemas.PayrollSummaryResponse:
        period = self.db.query(models.PayrollPeriod).filter(
            models.PayrollPeriod.id == period_id
        ).first()

        if not period:
            raise HTTPException(status_code=404, detail="Bordro dönemi bulunamadı")

        if tenant_id is not None and period.tenant_id != tenant_id:
            raise HTTPException(status_code=403, detail="Bu bordro dönemine erişim yetkiniz yok")

        entries = self.db.query(models.PayrollEntry).filter(
            models.PayrollEntry.payroll_period_id == period.id
        ).all()

        total_personnel_cost = sum(e.calculated_gross for e in entries)
        total_income_tax_exemption = sum(e.income_tax_exemption_amount for e in entries)
        total_stamp_tax_exemption = sum(e.stamp_tax_exemption_amount for e in entries)
        total_sgk_incentive = sum(e.sgk_employer_incentive_amount for e in entries)
        total_incentive = total_income_tax_exemption + total_stamp_tax_exemption + total_sgk_incentive

        total_sgk_employer = sum(e.calculated_gross * (0.205 + 0.02) for e in entries)
        payable_sgk = max(0.0, total_sgk_employer - total_sgk_incentive)

        return schemas.PayrollSummaryResponse(
            total_personnel_cost=total_personnel_cost,
            total_incentive=total_incentive,
            payable_sgk=payable_sgk,
            total_income_tax_exemption=total_income_tax_exemption,
            total_stamp_tax_exemption=total_stamp_tax_exemption,
        )


def get_payroll_service(db: Session) -> PayrollService:
    return PayrollService(db)
