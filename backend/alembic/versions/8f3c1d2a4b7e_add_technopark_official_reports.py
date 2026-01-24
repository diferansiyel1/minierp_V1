"""add technopark official reports

Revision ID: 8f3c1d2a4b7e
Revises: 7b6f1c2a3e5a
Create Date: 2026-01-24 12:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8f3c1d2a4b7e"
down_revision = "7b6f1c2a3e5a"
branch_labels = None
depends_on = None


def upgrade():
    technopark_line_category = sa.Enum(
        "RD_INCOME",
        "RD_INCOME_CHANGE",
        "RD_EXPENSE",
        "RD_EXPENSE_CHANGE",
        "NON_RD_EXPENSE",
        "NON_RD_EXPENSE_CHANGE",
        "NON_RD_INCOME",
        "NON_RD_INCOME_CHANGE",
        "FSMH",
        "FSMH_CHANGE",
        "TAX_EXEMPTION",
        "TAX_EXEMPTION_CHANGE",
        name="technoparklinecategory",
    )

    op.create_table(
        "technopark_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True, index=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("period_label", sa.String(), nullable=True),
        sa.Column("company_name", sa.String(), nullable=True),
        sa.Column("tax_office", sa.String(), nullable=True),
        sa.Column("tax_id", sa.String(), nullable=True),
        sa.Column("sgk_workplace_no", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_technopark_reports_tenant_id", "technopark_reports", ["tenant_id"])

    op.create_table(
        "technopark_project_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_id", sa.Integer(), sa.ForeignKey("technopark_reports.id"), index=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=True, index=True),
        sa.Column("project_name", sa.String(), nullable=False),
        sa.Column("stb_project_code", sa.String(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("planned_end_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("rd_personnel_count", sa.Integer(), default=0),
        sa.Column("support_personnel_count", sa.Integer(), default=0),
        sa.Column("non_scope_personnel_count", sa.Integer(), default=0),
        sa.Column("design_personnel_count", sa.Integer(), default=0),
        sa.Column("total_personnel_count", sa.Integer(), default=0),
    )
    op.create_index("ix_technopark_project_entries_report_id", "technopark_project_entries", ["report_id"])
    op.create_index("ix_technopark_project_entries_project_id", "technopark_project_entries", ["project_id"])

    op.create_table(
        "technopark_project_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_id", sa.Integer(), sa.ForeignKey("technopark_reports.id"), index=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=True, index=True),
        sa.Column("project_name", sa.String(), nullable=False),
        sa.Column("stb_project_code", sa.String(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("planned_end_date", sa.Date(), nullable=True),
        sa.Column("progress_text", sa.Text(), nullable=True),
        sa.Column("rd_personnel_count", sa.Integer(), default=0),
        sa.Column("support_personnel_count", sa.Integer(), default=0),
        sa.Column("non_scope_personnel_count", sa.Integer(), default=0),
        sa.Column("design_personnel_count", sa.Integer(), default=0),
        sa.Column("total_personnel_count", sa.Integer(), default=0),
    )
    op.create_index("ix_technopark_project_progress_report_id", "technopark_project_progress", ["report_id"])
    op.create_index("ix_technopark_project_progress_project_id", "technopark_project_progress", ["project_id"])

    op.create_table(
        "technopark_personnel_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_id", sa.Integer(), sa.ForeignKey("technopark_reports.id"), index=True),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id"), nullable=True, index=True),
        sa.Column("tc_id_no", sa.String(), nullable=True),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("personnel_type", sa.String(), nullable=True),
        sa.Column("is_it_personnel", sa.Boolean(), default=False),
        sa.Column("tgb_inside_minutes", sa.Integer(), default=0),
        sa.Column("tgb_outside_minutes", sa.Integer(), default=0),
        sa.Column("annual_leave_minutes", sa.Integer(), default=0),
        sa.Column("official_holiday_minutes", sa.Integer(), default=0),
        sa.Column("cb_outside_minutes", sa.Integer(), default=0),
        sa.Column("total_minutes", sa.Integer(), default=0),
    )
    op.create_index("ix_technopark_personnel_entries_report_id", "technopark_personnel_entries", ["report_id"])
    op.create_index("ix_technopark_personnel_entries_employee_id", "technopark_personnel_entries", ["employee_id"])

    op.create_table(
        "technopark_report_line_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_id", sa.Integer(), sa.ForeignKey("technopark_reports.id"), index=True),
        sa.Column("category", technopark_line_category, nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=True, index=True),
        sa.Column("project_name", sa.String(), nullable=True),
        sa.Column("item_type", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("amount", sa.Float(), default=0.0),
        sa.Column("period_label", sa.String(), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_technopark_report_line_items_report_id", "technopark_report_line_items", ["report_id"])
    op.create_index("ix_technopark_report_line_items_project_id", "technopark_report_line_items", ["project_id"])


def downgrade():
    op.drop_index("ix_technopark_report_line_items_project_id", table_name="technopark_report_line_items")
    op.drop_index("ix_technopark_report_line_items_report_id", table_name="technopark_report_line_items")
    op.drop_table("technopark_report_line_items")

    op.drop_index("ix_technopark_personnel_entries_employee_id", table_name="technopark_personnel_entries")
    op.drop_index("ix_technopark_personnel_entries_report_id", table_name="technopark_personnel_entries")
    op.drop_table("technopark_personnel_entries")

    op.drop_index("ix_technopark_project_progress_project_id", table_name="technopark_project_progress")
    op.drop_index("ix_technopark_project_progress_report_id", table_name="technopark_project_progress")
    op.drop_table("technopark_project_progress")

    op.drop_index("ix_technopark_project_entries_project_id", table_name="technopark_project_entries")
    op.drop_index("ix_technopark_project_entries_report_id", table_name="technopark_project_entries")
    op.drop_table("technopark_project_entries")

    op.drop_index("ix_technopark_reports_tenant_id", table_name="technopark_reports")
    op.drop_table("technopark_reports")

    op.execute("DROP TYPE IF EXISTS technoparklinecategory")
