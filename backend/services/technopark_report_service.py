from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
from collections import defaultdict

from sqlalchemy.orm import Session

from .. import models, schemas
from .tax_service import TaxService
from .payroll_service import PayrollService
from .reporting_service import ReportingService
from .legal_basis_service import LegalBasisService


class TechnoparkReportService:
    def __init__(self, db: Session):
        self.db = db
        self.tax_service = TaxService(db)
        self.payroll_service = PayrollService(db)
        self.reporting_service = ReportingService(db)
        self.legal_basis_service = LegalBasisService(db)

    def get_or_create_report(
        self, tenant_id: Optional[int], year: int, month: int
    ) -> models.TechnoparkReport:
        report = self.db.query(models.TechnoparkReport).filter(
            models.TechnoparkReport.tenant_id == tenant_id,
            models.TechnoparkReport.year == year,
            models.TechnoparkReport.month == month,
        ).first()

        if report:
            return report

        period_label = self._build_period_label(year, month)
        company_info = self._get_company_info(tenant_id)

        report = models.TechnoparkReport(
            tenant_id=tenant_id,
            year=year,
            month=month,
            period_label=period_label,
            company_name=company_info.get("company_name"),
            tax_office=company_info.get("tax_office"),
            tax_id=company_info.get("tax_id"),
            sgk_workplace_no=company_info.get("sgk_workplace_no"),
        )
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def upsert_report(
        self, tenant_id: Optional[int], payload: schemas.TechnoparkReportCreate
    ) -> models.TechnoparkReport:
        report = self.get_or_create_report(tenant_id, payload.year, payload.month)

        report.period_label = payload.period_label or report.period_label
        report.company_name = payload.company_name or report.company_name
        report.tax_office = payload.tax_office or report.tax_office
        report.tax_id = payload.tax_id or report.tax_id
        report.sgk_workplace_no = payload.sgk_workplace_no or report.sgk_workplace_no

        self._replace_project_entries(report, payload.project_entries)
        self._replace_project_progress_entries(report, payload.project_progress_entries)
        self._replace_personnel_entries(report, payload.personnel_entries)
        self._replace_line_items(report, payload.line_items)

        self.db.commit()
        self.db.refresh(report)
        return report

    def update_report(
        self, report_id: int, payload: schemas.TechnoparkReportUpdate
    ) -> models.TechnoparkReport:
        report = self.db.query(models.TechnoparkReport).filter(
            models.TechnoparkReport.id == report_id
        ).first()
        if not report:
            raise ValueError("Rapor bulunamadı")

        for field, value in payload.model_dump(exclude_unset=True).items():
            if field in {
                "project_entries",
                "project_progress_entries",
                "personnel_entries",
                "line_items",
            }:
                continue
            setattr(report, field, value)

        if payload.project_entries is not None:
            self._replace_project_entries(report, payload.project_entries)
        if payload.project_progress_entries is not None:
            self._replace_project_progress_entries(report, payload.project_progress_entries)
        if payload.personnel_entries is not None:
            self._replace_personnel_entries(report, payload.personnel_entries)
        if payload.line_items is not None:
            self._replace_line_items(report, payload.line_items)

        self.db.commit()
        self.db.refresh(report)
        return report

    def generate_official_pdf(self, report_id: int) -> Dict[str, Any]:
        report = self.db.query(models.TechnoparkReport).filter(
            models.TechnoparkReport.id == report_id
        ).first()
        if not report:
            raise ValueError("Rapor bulunamadı")

        tax_result = self.tax_service.calculate_monthly_tax_summary(
            report.tenant_id, report.year, report.month
        )
        legal_basis = self.legal_basis_service.get_technopark_legal_basis()

        pdf_buffer = self.reporting_service.generate_official_technopark_report(
            report=report,
            tax_result=tax_result,
            legal_basis=legal_basis,
        )

        period_label = report.period_label or self._build_period_label(report.year, report.month)
        filename = f"Teknokent_Muafiyet_Raporu_{period_label}.pdf"
        return {"buffer": pdf_buffer, "filename": filename}

    def build_autofill_payload(
        self, tenant_id: Optional[int], year: int, month: int
    ) -> schemas.TechnoparkReportCreate:
        report = self.db.query(models.TechnoparkReport).filter(
            models.TechnoparkReport.tenant_id == tenant_id,
            models.TechnoparkReport.year == year,
            models.TechnoparkReport.month == month,
        ).first()

        period_label = self._build_period_label(year, month)
        company_info = self._get_company_info(tenant_id)

        project_entries = self._build_project_entries(
            tenant_id, existing_entries=report.project_entries if report else []
        )
        project_progress_entries = self._build_project_progress_entries(
            tenant_id, existing_entries=report.project_progress_entries if report else []
        )
        personnel_entries = self._build_personnel_entries(
            tenant_id, year, month, existing_entries=report.personnel_entries if report else []
        )
        line_items = self._build_line_items(
            tenant_id, year, month, existing_items=report.line_items if report else []
        )

        return schemas.TechnoparkReportCreate(
            year=year,
            month=month,
            period_label=period_label,
            company_name=(
                report.company_name if report and report.company_name else company_info.get("company_name")
            ),
            tax_office=report.tax_office if report and report.tax_office else company_info.get("tax_office"),
            tax_id=report.tax_id if report and report.tax_id else company_info.get("tax_id"),
            sgk_workplace_no=(
                report.sgk_workplace_no if report and report.sgk_workplace_no else company_info.get("sgk_workplace_no")
            ),
            project_entries=project_entries,
            project_progress_entries=project_progress_entries,
            personnel_entries=personnel_entries,
            line_items=line_items,
        )

    def _replace_project_entries(
        self, report: models.TechnoparkReport, entries: List[schemas.TechnoparkProjectEntryBase]
    ) -> None:
        report.project_entries.clear()
        for entry in entries:
            report.project_entries.append(models.TechnoparkProjectEntry(**entry.model_dump()))

    def _replace_project_progress_entries(
        self, report: models.TechnoparkReport, entries: List[schemas.TechnoparkProjectProgressBase]
    ) -> None:
        report.project_progress_entries.clear()
        for entry in entries:
            report.project_progress_entries.append(models.TechnoparkProjectProgress(**entry.model_dump()))

    def _replace_personnel_entries(
        self, report: models.TechnoparkReport, entries: List[schemas.TechnoparkPersonnelEntryBase]
    ) -> None:
        report.personnel_entries.clear()
        for entry in entries:
            payload = entry.model_dump()
            payload["total_minutes"] = payload.get("total_minutes") or (
                payload.get("tgb_inside_minutes", 0)
                + payload.get("tgb_outside_minutes", 0)
                + payload.get("annual_leave_minutes", 0)
                + payload.get("official_holiday_minutes", 0)
            )
            report.personnel_entries.append(models.TechnoparkPersonnelEntry(**payload))

    def _replace_line_items(
        self, report: models.TechnoparkReport, entries: List[schemas.TechnoparkReportLineItemBase]
    ) -> None:
        report.line_items.clear()
        for entry in entries:
            payload = entry.model_dump()
            payload["category"] = entry.category.value
            report.line_items.append(models.TechnoparkReportLineItem(**payload))

    def _build_project_entries(
        self,
        tenant_id: Optional[int],
        existing_entries: List[models.TechnoparkProjectEntry],
    ) -> List[schemas.TechnoparkProjectEntryBase]:
        projects = self._get_active_technopark_projects(tenant_id)
        employees = self._get_active_employees(tenant_id)

        counts = self._count_personnel_by_project(employees)
        existing_map = self._map_existing_project_entries(existing_entries)

        entries: List[schemas.TechnoparkProjectEntryBase] = []
        for project in projects:
            entry_key = project.id or project.name
            existing = existing_map.get(entry_key)
            counts_for_project = counts.get(project.id or 0, {})
            total_count = counts_for_project.get("total", 0)
            use_existing_counts = total_count == 0 and existing is not None

            entries.append(
                schemas.TechnoparkProjectEntryBase(
                    project_id=project.id,
                    project_name=project.name,
                    stb_project_code=(
                        existing.stb_project_code
                        if existing and existing.stb_project_code
                        else project.code
                    ),
                    start_date=existing.start_date if existing and existing.start_date else project.start_date,
                    planned_end_date=(
                        existing.planned_end_date if existing and existing.planned_end_date else project.end_date
                    ),
                    end_date=existing.end_date if existing and existing.end_date else project.end_date,
                    rd_personnel_count=(
                        existing.rd_personnel_count if use_existing_counts else counts_for_project.get("rd", 0)
                    ),
                    support_personnel_count=(
                        existing.support_personnel_count if use_existing_counts else counts_for_project.get("support", 0)
                    ),
                    non_scope_personnel_count=(
                        existing.non_scope_personnel_count if use_existing_counts else counts_for_project.get("non_scope", 0)
                    ),
                    design_personnel_count=(
                        existing.design_personnel_count if use_existing_counts else counts_for_project.get("design", 0)
                    ),
                    total_personnel_count=(
                        existing.total_personnel_count if use_existing_counts else counts_for_project.get("total", 0)
                    ),
                )
            )
        return entries

    def _build_project_progress_entries(
        self,
        tenant_id: Optional[int],
        existing_entries: List[models.TechnoparkProjectProgress],
    ) -> List[schemas.TechnoparkProjectProgressBase]:
        projects = self._get_active_technopark_projects(tenant_id)
        existing_map = self._map_existing_project_progress(existing_entries)
        employees = self._get_active_employees(tenant_id)
        counts = self._count_personnel_by_project(employees)

        entries: List[schemas.TechnoparkProjectProgressBase] = []
        for project in projects:
            existing = existing_map.get(project.id or project.name)
            counts_for_project = counts.get(project.id or 0, {})
            total_count = counts_for_project.get("total", 0)
            use_existing_counts = total_count == 0 and existing is not None

            entries.append(
                schemas.TechnoparkProjectProgressBase(
                    project_id=project.id,
                    project_name=project.name,
                    stb_project_code=(
                        existing.stb_project_code
                        if existing and existing.stb_project_code
                        else project.code
                    ),
                    start_date=existing.start_date if existing and existing.start_date else project.start_date,
                    planned_end_date=(
                        existing.planned_end_date if existing and existing.planned_end_date else project.end_date
                    ),
                    progress_text=existing.progress_text if existing else "",
                    rd_personnel_count=(
                        existing.rd_personnel_count if use_existing_counts else counts_for_project.get("rd", 0)
                    ),
                    support_personnel_count=(
                        existing.support_personnel_count if use_existing_counts else counts_for_project.get("support", 0)
                    ),
                    non_scope_personnel_count=(
                        existing.non_scope_personnel_count if use_existing_counts else counts_for_project.get("non_scope", 0)
                    ),
                    design_personnel_count=(
                        existing.design_personnel_count if use_existing_counts else counts_for_project.get("design", 0)
                    ),
                    total_personnel_count=(
                        existing.total_personnel_count if use_existing_counts else counts_for_project.get("total", 0)
                    ),
                )
            )
        return entries

    def _build_personnel_entries(
        self,
        tenant_id: Optional[int],
        year: int,
        month: int,
        existing_entries: List[models.TechnoparkPersonnelEntry],
    ) -> List[schemas.TechnoparkPersonnelEntryBase]:
        employees = self._get_active_employees(tenant_id)
        entry_map = {entry.employee_id: entry for entry in existing_entries if entry.employee_id}

        period = self.db.query(models.PayrollPeriod).filter(
            models.PayrollPeriod.tenant_id == tenant_id,
            models.PayrollPeriod.year == year,
            models.PayrollPeriod.month == month,
        ).first()

        payroll_entries = []
        if period:
            payroll_entries = self.db.query(models.PayrollEntry).filter(
                models.PayrollEntry.payroll_period_id == period.id
            ).all()

        payroll_map = {entry.employee_id: entry for entry in payroll_entries}
        personnel_entries: List[schemas.TechnoparkPersonnelEntryBase] = []
        daily_minutes = 8 * 60

        for employee in employees:
            existing = entry_map.get(employee.id)
            payroll_entry = payroll_map.get(employee.id)
            worked_days = payroll_entry.worked_days if payroll_entry else 0
            remote_days = payroll_entry.remote_days if payroll_entry else 0
            has_payroll_minutes = payroll_entry and (
                payroll_entry.tgb_inside_minutes
                or payroll_entry.tgb_outside_minutes
                or payroll_entry.annual_leave_minutes
                or payroll_entry.official_holiday_minutes
                or payroll_entry.cb_outside_minutes
            )

            computed_inside = worked_days * daily_minutes
            computed_outside = remote_days * daily_minutes
            computed_cb_outside = computed_outside
            computed_total = (
                computed_inside
                + computed_outside
                + (existing.annual_leave_minutes if existing else 0)
                + (existing.official_holiday_minutes if existing else 0)
                + (existing.cb_outside_minutes if existing else 0)
            )

            use_existing_times = existing is not None and (
                existing.tgb_inside_minutes
                or existing.tgb_outside_minutes
                or existing.annual_leave_minutes
                or existing.official_holiday_minutes
            )

            personnel_entries.append(
                schemas.TechnoparkPersonnelEntryBase(
                    employee_id=employee.id,
                    tc_id_no=employee.tc_id_no,
                    full_name=employee.full_name,
                    personnel_type=self._map_personnel_type(employee.personnel_type),
                    is_it_personnel=employee.personnel_type == models.PersonnelType.SOFTWARE_PERSONNEL,
                    tgb_inside_minutes=(
                        payroll_entry.tgb_inside_minutes if has_payroll_minutes else (
                            existing.tgb_inside_minutes if use_existing_times else computed_inside
                        )
                    ),
                    tgb_outside_minutes=(
                        payroll_entry.tgb_outside_minutes if has_payroll_minutes else (
                            existing.tgb_outside_minutes if use_existing_times else computed_outside
                        )
                    ),
                    annual_leave_minutes=(
                        payroll_entry.annual_leave_minutes if has_payroll_minutes else (
                            existing.annual_leave_minutes if existing else 0
                        )
                    ),
                    official_holiday_minutes=(
                        payroll_entry.official_holiday_minutes if has_payroll_minutes else (
                            existing.official_holiday_minutes if existing else 0
                        )
                    ),
                    cb_outside_minutes=(
                        payroll_entry.cb_outside_minutes if has_payroll_minutes else (
                            existing.cb_outside_minutes if use_existing_times else computed_cb_outside
                        )
                    ),
                    total_minutes=(
                        payroll_entry.total_minutes if has_payroll_minutes else (
                            existing.total_minutes if use_existing_times else computed_total
                        )
                    ),
                )
            )

        return personnel_entries

    def _build_line_items(
        self,
        tenant_id: Optional[int],
        year: int,
        month: int,
        existing_items: List[models.TechnoparkReportLineItem],
    ) -> List[schemas.TechnoparkReportLineItemBase]:
        existing_by_category = defaultdict(list)
        for item in existing_items:
            category_value = getattr(item.category, "value", item.category)
            existing_by_category[category_value].append(item)

        line_items: List[schemas.TechnoparkReportLineItemBase] = []

        base_categories = {
            schemas.TechnoparkLineCategory.NON_RD_INCOME,
            schemas.TechnoparkLineCategory.RD_EXPENSE,
            schemas.TechnoparkLineCategory.NON_RD_EXPENSE,
            schemas.TechnoparkLineCategory.TAX_EXEMPTION,
        }

        for category in base_categories:
            existing = existing_by_category[category.value]
            if existing:
                for item in existing:
                    line_items.append(self._to_line_item_schema(item))
                continue

            if category == schemas.TechnoparkLineCategory.NON_RD_INCOME:
                line_items.extend(self._build_non_rd_income_items(tenant_id, year, month))
            elif category == schemas.TechnoparkLineCategory.RD_EXPENSE:
                line_items.extend(self._build_rd_expense_items(tenant_id, year, month))
            elif category == schemas.TechnoparkLineCategory.NON_RD_EXPENSE:
                line_items.extend(self._build_non_rd_expense_items(tenant_id, year, month))
            elif category == schemas.TechnoparkLineCategory.TAX_EXEMPTION:
                line_items.extend(self._build_tax_exemption_items(tenant_id, year, month))

        line_items.extend(self._build_change_items(tenant_id, year, month, line_items))

        for category, items in existing_by_category.items():
            if category in {c.value for c in base_categories}:
                continue
            for item in items:
                line_items.append(self._to_line_item_schema(item))

        return line_items

    def _build_non_rd_income_items(
        self, tenant_id: Optional[int], year: int, month: int
    ) -> List[schemas.TechnoparkReportLineItemBase]:
        invoices = self.db.query(models.Invoice).filter(
            models.Invoice.invoice_type == models.InvoiceType.SALES,
            self._match_period(models.Invoice.issue_date, year, month),
        )
        if tenant_id:
            invoices = invoices.filter(models.Invoice.tenant_id == tenant_id)
        sales = invoices.all()

        total_non_rd = 0.0
        for invoice in sales:
            is_technopark = bool(invoice.project and invoice.project.is_technopark_project)
            if is_technopark:
                continue
            if invoice.taxable_amount and invoice.taxable_amount > 0:
                total_non_rd += float(invoice.taxable_amount)
                continue
            line_total = 0.0
            for item in invoice.items:
                if not item.is_exempt:
                    line_total += float(item.line_total or 0.0)
            total_non_rd += line_total

        if total_non_rd <= 0:
            return []

        return [
            schemas.TechnoparkReportLineItemBase(
                category=schemas.TechnoparkLineCategory.NON_RD_INCOME,
                item_type="Ar-Ge Dışı Satış",
                amount=total_non_rd,
            )
        ]

    def _build_rd_expense_items(
        self, tenant_id: Optional[int], year: int, month: int
    ) -> List[schemas.TechnoparkReportLineItemBase]:
        invoices = self.db.query(models.Invoice).filter(
            models.Invoice.invoice_type == models.InvoiceType.PURCHASE,
            models.Invoice.expense_center == models.ExpenseCenter.RD_CENTER.value,
            self._match_period(models.Invoice.issue_date, year, month),
        )
        if tenant_id:
            invoices = invoices.filter(models.Invoice.tenant_id == tenant_id)
        expenses = invoices.all()

        grouped: Dict[Tuple[Optional[int], str, str], float] = defaultdict(float)
        for invoice in expenses:
            project_id = invoice.project_id
            project_name = invoice.project.name if invoice.project else "Genel"
            expense_type = invoice.expense_category or "Diğer"
            grouped[(project_id, project_name, expense_type)] += float(invoice.total_amount or 0.0)

        items = []
        for (project_id, project_name, expense_type), amount in grouped.items():
            items.append(
                schemas.TechnoparkReportLineItemBase(
                    category=schemas.TechnoparkLineCategory.RD_EXPENSE,
                    project_id=project_id,
                    project_name=project_name,
                    item_type=expense_type,
                    amount=amount,
                )
            )
        return items

    def _build_non_rd_expense_items(
        self, tenant_id: Optional[int], year: int, month: int
    ) -> List[schemas.TechnoparkReportLineItemBase]:
        invoices = self.db.query(models.Invoice).filter(
            models.Invoice.invoice_type == models.InvoiceType.PURCHASE,
            self._match_period(models.Invoice.issue_date, year, month),
        )
        if tenant_id:
            invoices = invoices.filter(models.Invoice.tenant_id == tenant_id)
        expenses = invoices.filter(
            (models.Invoice.expense_center != models.ExpenseCenter.RD_CENTER.value)
            | (models.Invoice.expense_center.is_(None))
        ).all()

        grouped: Dict[str, float] = defaultdict(float)
        for invoice in expenses:
            expense_type = invoice.expense_category or "Diğer"
            grouped[expense_type] += float(invoice.total_amount or 0.0)

        items = []
        for expense_type, amount in grouped.items():
            items.append(
                schemas.TechnoparkReportLineItemBase(
                    category=schemas.TechnoparkLineCategory.NON_RD_EXPENSE,
                    item_type=expense_type,
                    amount=amount,
                )
            )
        return items

    def _build_tax_exemption_items(
        self, tenant_id: Optional[int], year: int, month: int
    ) -> List[schemas.TechnoparkReportLineItemBase]:
        tax_result = self.tax_service.calculate_monthly_tax_summary(tenant_id, year, month)
        income_tax_total, stamp_tax_total, sgk_total = self._get_payroll_exemption_totals(
            tenant_id, year, month
        )

        if income_tax_total == 0 and stamp_tax_total == 0 and sgk_total == 0:
            income_tax_total = sum(
                p.calculated_income_tax_exemption for p in tax_result.personnel_incentives
            )
            stamp_tax_total = sum(p.stamp_tax_exemption for p in tax_result.personnel_incentives)
            sgk_total = sum(p.sgk_employer_discount for p in tax_result.personnel_incentives)

        return [
            schemas.TechnoparkReportLineItemBase(
                category=schemas.TechnoparkLineCategory.TAX_EXEMPTION,
                item_type="Kurumlar Vergisi İstisnası",
                amount=tax_result.corporate_tax.corporate_tax_exemption,
            ),
            schemas.TechnoparkReportLineItemBase(
                category=schemas.TechnoparkLineCategory.TAX_EXEMPTION,
                item_type="KDV Muafiyeti",
                amount=tax_result.corporate_tax.vat_exemption,
            ),
            schemas.TechnoparkReportLineItemBase(
                category=schemas.TechnoparkLineCategory.TAX_EXEMPTION,
                item_type="Personel Gelir Vergisi İstisnası",
                amount=income_tax_total,
            ),
            schemas.TechnoparkReportLineItemBase(
                category=schemas.TechnoparkLineCategory.TAX_EXEMPTION,
                item_type="SGK İşveren Hissesi Desteği",
                amount=sgk_total,
            ),
            schemas.TechnoparkReportLineItemBase(
                category=schemas.TechnoparkLineCategory.TAX_EXEMPTION,
                item_type="Damga Vergisi İstisnası",
                amount=stamp_tax_total,
            ),
        ]

    def _build_change_items(
        self,
        tenant_id: Optional[int],
        year: int,
        month: int,
        current_items: List[schemas.TechnoparkReportLineItemBase],
    ) -> List[schemas.TechnoparkReportLineItemBase]:
        previous_report = self._get_previous_report(tenant_id, year, month)
        if not previous_report:
            return []

        change_items: List[schemas.TechnoparkReportLineItemBase] = []
        previous_by_category = defaultdict(list)
        for item in previous_report.line_items:
            previous_by_category[getattr(item.category, "value", item.category)].append(item)

        categories = {
            schemas.TechnoparkLineCategory.NON_RD_INCOME: schemas.TechnoparkLineCategory.NON_RD_INCOME_CHANGE,
            schemas.TechnoparkLineCategory.RD_EXPENSE: schemas.TechnoparkLineCategory.RD_EXPENSE_CHANGE,
            schemas.TechnoparkLineCategory.NON_RD_EXPENSE: schemas.TechnoparkLineCategory.NON_RD_EXPENSE_CHANGE,
            schemas.TechnoparkLineCategory.FSMH: schemas.TechnoparkLineCategory.FSMH_CHANGE,
            schemas.TechnoparkLineCategory.TAX_EXEMPTION: schemas.TechnoparkLineCategory.TAX_EXEMPTION_CHANGE,
        }

        for base_category, change_category in categories.items():
            current = [item for item in current_items if item.category == base_category]
            previous = previous_by_category[base_category.value]
            prev_map = {
                self._line_item_key(item): float(item.amount or 0.0)
                for item in previous
            }
            for item in current:
                key = self._line_item_key(item)
                prev_amount = prev_map.get(key)
                if prev_amount is None or abs(prev_amount - float(item.amount or 0.0)) > 0.0001:
                    change_items.append(
                        schemas.TechnoparkReportLineItemBase(
                            category=change_category,
                            project_name=item.project_name,
                            item_type=item.item_type,
                            title=item.title,
                            amount=item.amount,
                            period_label=previous_report.period_label,
                            changed_at=datetime.now(),
                        )
                    )

        return change_items

    def _get_active_technopark_projects(
        self, tenant_id: Optional[int]
    ) -> List[models.Project]:
        query = self.db.query(models.Project).filter(
            models.Project.status == models.ProjectStatus.ACTIVE.value,
            models.Project.is_technopark_project == True,
        )
        if tenant_id:
            query = query.filter(models.Project.tenant_id == tenant_id)
        return query.order_by(models.Project.name.asc()).all()

    def _get_active_employees(self, tenant_id: Optional[int]) -> List[models.Employee]:
        query = self.db.query(models.Employee).filter(models.Employee.is_active == True)
        if tenant_id:
            query = query.filter(models.Employee.tenant_id == tenant_id)
        return query.order_by(models.Employee.full_name.asc()).all()

    def _count_personnel_by_project(
        self, employees: List[models.Employee]
    ) -> Dict[int, Dict[str, int]]:
        counts: Dict[int, Dict[str, int]] = defaultdict(lambda: {
            "rd": 0,
            "support": 0,
            "non_scope": 0,
            "design": 0,
            "total": 0,
        })
        for employee in employees:
            project_id = employee.project_id or 0
            if employee.personnel_type in {
                models.PersonnelType.RD_PERSONNEL,
                models.PersonnelType.SOFTWARE_PERSONNEL,
            }:
                counts[project_id]["rd"] += 1
            elif employee.personnel_type == models.PersonnelType.SUPPORT_PERSONNEL:
                counts[project_id]["support"] += 1
            else:
                counts[project_id]["non_scope"] += 1
            counts[project_id]["total"] += 1
        return counts

    def _map_existing_project_entries(
        self, entries: List[models.TechnoparkProjectEntry]
    ) -> Dict[Any, models.TechnoparkProjectEntry]:
        return {
            (entry.project_id or entry.project_name): entry
            for entry in entries
        }

    def _map_existing_project_progress(
        self, entries: List[models.TechnoparkProjectProgress]
    ) -> Dict[Any, models.TechnoparkProjectProgress]:
        return {
            (entry.project_id or entry.project_name): entry
            for entry in entries
        }

    def _get_previous_report(
        self, tenant_id: Optional[int], year: int, month: int
    ) -> Optional[models.TechnoparkReport]:
        current_period = year * 12 + month
        reports = self.db.query(models.TechnoparkReport).filter(
            models.TechnoparkReport.tenant_id == tenant_id
        ).order_by(models.TechnoparkReport.year.desc(), models.TechnoparkReport.month.desc()).all()
        for report in reports:
            report_period = report.year * 12 + report.month
            if report_period < current_period:
                return report
        return None

    def _line_item_key(self, item: Any) -> Tuple[str, str, str]:
        project_name = getattr(item, "project_name", None) or ""
        item_type = getattr(item, "item_type", None) or ""
        title = getattr(item, "title", None) or ""
        return (project_name, item_type, title)

    def _map_personnel_type(self, personnel_type: models.PersonnelType) -> str:
        mapping = {
            models.PersonnelType.RD_PERSONNEL: "Ar-Ge Personeli",
            models.PersonnelType.SUPPORT_PERSONNEL: "Destek Personeli",
            models.PersonnelType.INTERN: "Stajyer",
            models.PersonnelType.SOFTWARE_PERSONNEL: "Yazılım Personeli",
        }
        return mapping.get(personnel_type, "Personel")

    def _get_payroll_exemption_totals(
        self, tenant_id: Optional[int], year: int, month: int
    ) -> Tuple[float, float, float]:
        period = self.db.query(models.PayrollPeriod).filter(
            models.PayrollPeriod.tenant_id == tenant_id,
            models.PayrollPeriod.year == year,
            models.PayrollPeriod.month == month,
        ).first()
        if not period:
            return 0.0, 0.0, 0.0

        entries = self.db.query(models.PayrollEntry).filter(
            models.PayrollEntry.payroll_period_id == period.id
        ).all()
        income_tax_total = sum(e.income_tax_exemption_amount for e in entries)
        stamp_tax_total = sum(e.stamp_tax_exemption_amount for e in entries)
        sgk_total = sum(e.sgk_employer_incentive_amount for e in entries)
        return income_tax_total, stamp_tax_total, sgk_total

    def _match_period(self, column, year: int, month: int):
        from sqlalchemy import extract

        return (extract("year", column) == year) & (extract("month", column) == month)

    def _to_line_item_schema(
        self, item: models.TechnoparkReportLineItem
    ) -> schemas.TechnoparkReportLineItemBase:
        return schemas.TechnoparkReportLineItemBase(
            category=schemas.TechnoparkLineCategory(
                getattr(item.category, "value", item.category)
            ),
            project_id=item.project_id,
            project_name=item.project_name,
            item_type=item.item_type,
            title=item.title,
            amount=item.amount,
            period_label=item.period_label,
            changed_at=item.changed_at,
            notes=item.notes,
        )

    def _get_company_info(self, tenant_id: Optional[int]) -> Dict[str, Any]:
        if not tenant_id:
            return {}
        tenant = self.db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
        if tenant and tenant.settings:
            try:
                import json
                return json.loads(tenant.settings)
            except Exception:
                return {}
        return {}

    def _build_period_label(self, year: int, month: int) -> str:
        month_names = [
            "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
            "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
        ]
        month_name = month_names[month] if 1 <= month <= 12 else str(month)
        return f"{month_name} - {year}"


def get_technopark_report_service(db: Session) -> TechnoparkReportService:
    return TechnoparkReportService(db)
