"""
Database Migration Script - vTiger CRM 7.5 Compatible Fields
Run this script to add new columns to existing tables without data loss.

Usage:
    python migrate_vtiger_fields.py
"""

import sqlite3
import os

# Database path
DB_PATH = os.path.join(os.path.dirname(__file__), 'minierp.db')

# New columns to add to accounts table
ACCOUNTS_COLUMNS = [
    ("vtiger_id", "TEXT"),
    ("ship_street", "TEXT"),
    ("ship_city", "TEXT"),
    ("ship_state", "TEXT"),
    ("ship_code", "TEXT"),
    ("ship_country", "TEXT"),
    ("website", "TEXT"),
    ("industry", "TEXT"),
    ("employees", "INTEGER"),
    ("annual_revenue", "REAL"),
    ("description", "TEXT"),
    ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
    ("modified_at", "TIMESTAMP"),
]

# New columns to add to contacts table
CONTACTS_COLUMNS = [
    ("vtiger_id", "TEXT"),
    ("mobile", "TEXT"),
    ("department", "TEXT"),
    ("salutation", "TEXT"),
    ("mailing_street", "TEXT"),
    ("mailing_city", "TEXT"),
    ("mailing_state", "TEXT"),
    ("mailing_zip", "TEXT"),
    ("mailing_country", "TEXT"),
    ("do_not_call", "BOOLEAN DEFAULT 0"),
    ("email_opt_out", "BOOLEAN DEFAULT 0"),
    ("description", "TEXT"),
    ("modified_at", "TIMESTAMP"),
]


def get_existing_columns(cursor, table_name):
    """Get list of existing column names in a table"""
    cursor.execute(f"PRAGMA table_info({table_name})")
    return [row[1] for row in cursor.fetchall()]


def add_column_if_not_exists(cursor, table_name, column_name, column_type):
    """Add column to table if it doesn't already exist"""
    existing = get_existing_columns(cursor, table_name)
    if column_name not in existing:
        try:
            cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")
            print(f"  ✓ Added column: {table_name}.{column_name}")
            return True
        except sqlite3.OperationalError as e:
            print(f"  ✗ Error adding {table_name}.{column_name}: {e}")
            return False
    else:
        print(f"  - Column already exists: {table_name}.{column_name}")
        return False


def run_migration():
    """Run the migration"""
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        return False
    
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    added_count = 0
    
    # Migrate accounts table
    print("\n📦 Migrating 'accounts' table...")
    for col_name, col_type in ACCOUNTS_COLUMNS:
        if add_column_if_not_exists(cursor, "accounts", col_name, col_type):
            added_count += 1
    
    # Migrate contacts table
    print("\n📦 Migrating 'contacts' table...")
    for col_name, col_type in CONTACTS_COLUMNS:
        if add_column_if_not_exists(cursor, "contacts", col_name, col_type):
            added_count += 1
    
    # Create indexes for vtiger_id columns
    print("\n🔍 Creating indexes...")
    try:
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_accounts_vtiger_id ON accounts(vtiger_id)")
        print("  ✓ Created index: ix_accounts_vtiger_id")
    except sqlite3.OperationalError:
        print("  - Index already exists: ix_accounts_vtiger_id")
    
    try:
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_contacts_vtiger_id ON contacts(vtiger_id)")
        print("  ✓ Created index: ix_contacts_vtiger_id")
    except sqlite3.OperationalError:
        print("  - Index already exists: ix_contacts_vtiger_id")
    
    conn.commit()
    conn.close()
    
    print(f"\n✅ Migration complete! Added {added_count} new columns.")
    return True


if __name__ == "__main__":
    print("=" * 50)
    print("vTiger CRM 7.5 Compatible Fields Migration")
    print("=" * 50)
    run_migration()
