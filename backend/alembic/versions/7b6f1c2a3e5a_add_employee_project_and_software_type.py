"""add_employee_project_and_software_type

Revision ID: 7b6f1c2a3e5a
Revises: 678d50de622b
Create Date: 2026-01-23 20:10:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "7b6f1c2a3e5a"
down_revision = "678d50de622b"
branch_labels = None
depends_on = None


def _dialect_name() -> str:
    return op.get_bind().dialect.name


def upgrade() -> None:
    if _dialect_name() == "postgresql":
        op.execute(
            "ALTER TYPE personneltype ADD VALUE IF NOT EXISTS 'SOFTWARE_PERSONNEL'"
        )

    if _dialect_name() == "sqlite":
        with op.batch_alter_table("employees") as batch_op:
            batch_op.add_column(sa.Column("project_id", sa.Integer(), nullable=True))
            batch_op.create_index(batch_op.f("ix_employees_project_id"), ["project_id"], unique=False)
            batch_op.create_foreign_key(None, "projects", ["project_id"], ["id"])
        return

    op.add_column("employees", sa.Column("project_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_employees_project_id"), "employees", ["project_id"], unique=False)
    op.create_foreign_key(None, "employees", "projects", ["project_id"], ["id"])


def downgrade() -> None:
    if _dialect_name() == "sqlite":
        with op.batch_alter_table("employees") as batch_op:
            batch_op.drop_constraint(None, type_="foreignkey")
            batch_op.drop_index(batch_op.f("ix_employees_project_id"))
            batch_op.drop_column("project_id")
        return

    op.drop_constraint(None, "employees", type_="foreignkey")
    op.drop_index(op.f("ix_employees_project_id"), table_name="employees")
    op.drop_column("employees", "project_id")
