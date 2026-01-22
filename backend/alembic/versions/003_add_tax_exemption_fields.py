"""Add tax exemption fields for 2026 Technopark Module

Revision ID: 003_tax_exemption
Revises: 1dd2ee1f07cd
Create Date: 2026-01-22

"""
from alembic import op
import sqlalchemy as sa
import json


# revision identifiers, used by Alembic.
revision = '003_tax_exemption'
down_revision = '1dd2ee1f07cd'
branch_labels = None
depends_on = None


def column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table (SQLite compatible)"""
    conn = op.get_bind()
    result = conn.execute(sa.text(f"PRAGMA table_info({table_name})"))
    columns = [row[1] for row in result]
    return column_name in columns


def upgrade() -> None:
    # Add new columns to exemption_reports for venture capital and tax calculations
    # Only add if not exists
    
    if not column_exists('exemption_reports', 'venture_capital_obligation'):
        op.add_column('exemption_reports', sa.Column('venture_capital_obligation', sa.Float(), nullable=True, server_default='0'))
    
    if not column_exists('exemption_reports', 'is_venture_capital_invested'):
        op.add_column('exemption_reports', sa.Column('is_venture_capital_invested', sa.Boolean(), nullable=True, server_default='0'))
    
    if not column_exists('exemption_reports', 'remote_work_ratio_applied'):
        op.add_column('exemption_reports', sa.Column('remote_work_ratio_applied', sa.Float(), nullable=True, server_default='1.0'))
    
    if not column_exists('exemption_reports', 'calculated_tax_advantage'):
        op.add_column('exemption_reports', sa.Column('calculated_tax_advantage', sa.Float(), nullable=True, server_default='0'))
    
    if not column_exists('exemption_reports', 'exemption_base'):
        op.add_column('exemption_reports', sa.Column('exemption_base', sa.Float(), nullable=True, server_default='0'))
    
    # Create index for tenant_id on exemption_reports (skip if exists)
    try:
        op.create_index('ix_exemption_reports_tenant_id', 'exemption_reports', ['tenant_id'])
    except Exception:
        pass  # Index may already exist
    
    # Seed tax_parameters_2026 into system_settings
    tax_params_2026 = {
        "year": 2026,
        "venture_capital_limit": 5000000.0,
        "venture_capital_rate": 0.03,
        "venture_capital_max_amount": 100000000.0,
        "remote_work_rate_informatics": 1.0,
        "remote_work_rate_other": 0.75,
        "income_tax_exemptions": {
            "phd_basic_sciences": 0.95,
            "masters_basic_sciences": 0.90,
            "phd_other": 0.90,
            "masters_other": 0.80,
            "bachelors": 0.80
        },
        "corporate_tax_rate": 0.25,
        "vat_rate": 0.20,
        "daily_food_exemption": 300.0,
        "daily_transport_exemption": 158.0,
        "sgk_employer_share_discount": 0.50,
        "stamp_tax_exemption_rate": 1.0
    }
    
    op.execute(
        sa.text(
            "INSERT OR REPLACE INTO system_settings (key, value, description) VALUES (:key, :value, :description)"
        ).bindparams(
            key="tax_parameters_2026",
            value=json.dumps(tax_params_2026),
            description="2026 Yılı Teknokent Vergi Parametreleri (5746/4691 Sayılı Kanun)"
        )
    )


def downgrade() -> None:
    # Remove seeded data
    op.execute(sa.text("DELETE FROM system_settings WHERE key = 'tax_parameters_2026'"))
    
    # Drop index
    try:
        op.drop_index('ix_exemption_reports_tenant_id', 'exemption_reports')
    except Exception:
        pass
    
    # Remove columns from exemption_reports
    with op.batch_alter_table('exemption_reports', schema=None) as batch_op:
        try:
            batch_op.drop_column('exemption_base')
        except Exception:
            pass
        try:
            batch_op.drop_column('calculated_tax_advantage')
        except Exception:
            pass
        try:
            batch_op.drop_column('remote_work_ratio_applied')
        except Exception:
            pass
        try:
            batch_op.drop_column('is_venture_capital_invested')
        except Exception:
            pass
        try:
            batch_op.drop_column('venture_capital_obligation')
        except Exception:
            pass
