"""seed initial data

Revision ID: 002_seed_initial_data
Revises: 1b89343f7938
Create Date: 2024-01-14 10:05:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '002_seed_initial_data'
down_revision = '1b89343f7938'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Create Default Tenant
    op.execute("INSERT INTO tenants (id, name, slug, is_active, created_at) VALUES (1, 'Default Company', 'default', TRUE, CURRENT_TIMESTAMP)")
    
    # 2. Create Superadmin User
    # Password hash for 'admin' (bcrypt) - purely example, in real world use proper hash
    # $2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxwKc.6IymCs7CN52au9gmfoExW1q is 'admin' (generated elsewhere)
    # Using a simple known hash or just a placeholder if passlib availability is complex here.
    # Let's try to import passlib context if possible, or just insert a known hash.
    # Hash for 'admin': $2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxwKc.6IymCs7CN52au9gmfoExW1q
    
    admin_hash = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxwKc.6IymCs7CN52au9gmfoExW1q" 
    
    op.execute(f"INSERT INTO users (email, hashed_password, full_name, role, is_active, tenant_id, created_at) VALUES ('admin@pikolab.com', '{admin_hash}', 'Super Admin', 'superadmin', TRUE, 1, CURRENT_TIMESTAMP)")

def downgrade() -> None:
    op.execute("DELETE FROM users WHERE email = 'admin@pikolab.com'")
    op.execute("DELETE FROM tenants WHERE id = 1")
