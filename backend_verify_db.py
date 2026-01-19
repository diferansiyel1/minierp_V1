
import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

# Force backend path to be importable
sys.path.append('/app')

from backend.database import SessionLocal
from backend.models import Account, AccountType, CustomerType

def check_db():
    print("Checking Database Connection...")
    try:
        db = SessionLocal()
        # Try a simple query
        result = db.execute(text("SELECT 1")).scalar()
        print(f"Database Connection OK. Result: {result}")
        
        # Try to insert a test account
        print("Attempting to create a test account...")
        new_account = Account(
            title="Test Account Auto-Verify",
            account_type=AccountType.CUSTOMER.value,
            entity_type=CustomerType.CORPORATE.value
        )
        db.add(new_account)
        db.commit()
        print(f"Successfully created account with ID: {new_account.id}")
        
        # Verify fetch
        fetched = db.query(Account).filter(Account.id == new_account.id).first()
        print(f"Fetched Account: {fetched.title}")
        
        # Cleanup
        db.delete(fetched)
        db.commit()
        print("Cleanup successful.")
        
    except Exception as e:
        print(f"FATAL ERROR: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    check_db()
