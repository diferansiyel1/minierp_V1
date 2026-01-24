"""add payroll minutes fields

Revision ID: 9a2b3c4d5e6f
Revises: 8f3c1d2a4b7e
Create Date: 2026-01-24 13:05:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9a2b3c4d5e6f"
down_revision = "8f3c1d2a4b7e"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("payroll_entries", sa.Column("tgb_inside_minutes", sa.Integer(), server_default="0", nullable=False))
    op.add_column("payroll_entries", sa.Column("tgb_outside_minutes", sa.Integer(), server_default="0", nullable=False))
    op.add_column("payroll_entries", sa.Column("annual_leave_minutes", sa.Integer(), server_default="0", nullable=False))
    op.add_column("payroll_entries", sa.Column("official_holiday_minutes", sa.Integer(), server_default="0", nullable=False))
    op.add_column("payroll_entries", sa.Column("cb_outside_minutes", sa.Integer(), server_default="0", nullable=False))
    op.add_column("payroll_entries", sa.Column("total_minutes", sa.Integer(), server_default="0", nullable=False))


def downgrade():
    op.drop_column("payroll_entries", "total_minutes")
    op.drop_column("payroll_entries", "cb_outside_minutes")
    op.drop_column("payroll_entries", "official_holiday_minutes")
    op.drop_column("payroll_entries", "annual_leave_minutes")
    op.drop_column("payroll_entries", "tgb_outside_minutes")
    op.drop_column("payroll_entries", "tgb_inside_minutes")
