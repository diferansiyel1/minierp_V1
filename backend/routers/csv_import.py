"""CSV Import Router - vTiger CRM 7.5 uyumlu"""
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from sqlalchemy.orm import Session
import csv
import io
from typing import List, Dict, Any
from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/import",
    tags=["import"],
)


# vTiger CRM field mapping for Accounts (Organizations)
VTIGER_ACCOUNT_MAPPING = {
    "accountid": "vtiger_id",
    "accountname": "title",
    "account_type": "account_type",
    "phone": "phone",
    "email1": "email",
    "website": "website",
    "industry": "industry",
    "employees": "employees",
    "annual_revenue": "annual_revenue",
    # Billing address
    "bill_street": "address",
    "bill_city": "billing_address",  # Combined with street
    # Shipping address
    "ship_street": "ship_street",
    "ship_city": "ship_city",
    "ship_state": "ship_state",
    "ship_code": "ship_code",
    "ship_country": "ship_country",
    "description": "description",
}

# vTiger CRM field mapping for Contacts
VTIGER_CONTACT_MAPPING = {
    "contactid": "vtiger_id",
    "firstname": "first_name",
    "lastname": "last_name",
    "email": "email",
    "phone": "phone",
    "mobile": "mobile",
    "title": "role",
    "department": "department",
    "salutation": "salutation",
    "mailingstreet": "mailing_street",
    "mailingcity": "mailing_city",
    "mailingstate": "mailing_state",
    "mailingzip": "mailing_zip",
    "mailingcountry": "mailing_country",
    "donotcall": "do_not_call",
    "emailoptout": "email_opt_out",
    "description": "description",
    "accountid": "vtiger_account_id",  # Will be resolved to account_id
}


def parse_csv_file(file_content: bytes) -> List[Dict[str, Any]]:
    """Parse CSV content and return list of dictionaries"""
    try:
        # Try UTF-8 first, then fallback to latin-1
        try:
            content = file_content.decode('utf-8')
        except UnicodeDecodeError:
            content = file_content.decode('latin-1')
        
        # Use csv.DictReader to parse
        reader = csv.DictReader(io.StringIO(content))
        return list(reader)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {str(e)}")


def map_vtiger_fields(row: Dict[str, str], mapping: Dict[str, str]) -> Dict[str, Any]:
    """Map vTiger CSV fields to our schema fields"""
    result = {}
    for vtiger_field, our_field in mapping.items():
        # Try lowercase and original case
        value = row.get(vtiger_field) or row.get(vtiger_field.lower()) or row.get(vtiger_field.upper())
        if value is not None and value.strip():
            result[our_field] = value.strip()
    return result


@router.post("/accounts")
async def import_accounts_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Import accounts from vTiger CRM CSV export.
    
    Expected CSV columns (case-insensitive):
    - accountid, accountname, phone, email1, website, industry, employees
    - annual_revenue, bill_street, bill_city, ship_street, ship_city, etc.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()
    rows = parse_csv_file(content)
    
    created_count = 0
    updated_count = 0
    errors = []
    
    for i, row in enumerate(rows, start=2):  # Start at 2 (header is 1)
        try:
            mapped = map_vtiger_fields(row, VTIGER_ACCOUNT_MAPPING)
            
            if not mapped.get("title"):
                errors.append(f"Row {i}: Missing account name")
                continue
            
            # Check if account exists by vtiger_id
            existing = None
            if mapped.get("vtiger_id"):
                existing = db.query(models.Account).filter(
                    models.Account.vtiger_id == mapped["vtiger_id"]
                ).first()
            
            # Also check by title if no vtiger_id match
            if not existing:
                existing = db.query(models.Account).filter(
                    models.Account.title == mapped["title"]
                ).first()
            
            if existing:
                # Update existing account
                for key, value in mapped.items():
                    if hasattr(existing, key) and value:
                        setattr(existing, key, value)
                updated_count += 1
            else:
                # Create new account
                new_account = models.Account(
                    account_type=mapped.get("account_type", "Customer"),
                    entity_type="Corporate",
                    title=mapped["title"],
                    tax_id=mapped.get("tax_id"),
                    tax_office=mapped.get("tax_office"),
                    address=mapped.get("address"),
                    billing_address=mapped.get("billing_address"),
                    ship_street=mapped.get("ship_street"),
                    ship_city=mapped.get("ship_city"),
                    ship_state=mapped.get("ship_state"),
                    ship_code=mapped.get("ship_code"),
                    ship_country=mapped.get("ship_country"),
                    website=mapped.get("website"),
                    industry=mapped.get("industry"),
                    employees=int(mapped["employees"]) if mapped.get("employees") else None,
                    annual_revenue=float(mapped["annual_revenue"]) if mapped.get("annual_revenue") else None,
                    description=mapped.get("description"),
                    phone=mapped.get("phone"),
                    email=mapped.get("email"),
                    vtiger_id=mapped.get("vtiger_id"),
                )
                db.add(new_account)
                created_count += 1
        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
    
    db.commit()
    
    return {
        "success": True,
        "created": created_count,
        "updated": updated_count,
        "errors": errors[:20] if errors else [],  # Return first 20 errors
        "total_errors": len(errors)
    }


@router.post("/contacts")
async def import_contacts_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Import contacts from vTiger CRM CSV export.
    
    Expected CSV columns (case-insensitive):
    - contactid, firstname, lastname, email, phone, mobile, title
    - department, salutation, accountid (vtiger account ID)
    - mailingstreet, mailingcity, mailingstate, mailingzip, mailingcountry
    
    Note: Accounts should be imported first for proper linking.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()
    rows = parse_csv_file(content)
    
    created_count = 0
    updated_count = 0
    errors = []
    
    for i, row in enumerate(rows, start=2):
        try:
            mapped = map_vtiger_fields(row, VTIGER_CONTACT_MAPPING)
            
            if not mapped.get("first_name") and not mapped.get("last_name"):
                errors.append(f"Row {i}: Missing contact name")
                continue
            
            # Resolve account_id from vtiger_account_id
            account_id = None
            vtiger_account_id = mapped.pop("vtiger_account_id", None)
            
            if vtiger_account_id:
                account = db.query(models.Account).filter(
                    models.Account.vtiger_id == vtiger_account_id
                ).first()
                if account:
                    account_id = account.id
            
            if not account_id:
                errors.append(f"Row {i}: Account not found for contact {mapped.get('first_name')} {mapped.get('last_name')}")
                continue
            
            # Check if contact exists by vtiger_id
            existing = None
            if mapped.get("vtiger_id"):
                existing = db.query(models.Contact).filter(
                    models.Contact.vtiger_id == mapped["vtiger_id"]
                ).first()
            
            if existing:
                # Update existing contact
                for key, value in mapped.items():
                    if hasattr(existing, key) and value:
                        setattr(existing, key, value)
                existing.account_id = account_id
                updated_count += 1
            else:
                # Create new contact
                new_contact = models.Contact(
                    account_id=account_id,
                    first_name=mapped.get("first_name", ""),
                    last_name=mapped.get("last_name", ""),
                    email=mapped.get("email"),
                    phone=mapped.get("phone"),
                    mobile=mapped.get("mobile"),
                    role=mapped.get("role"),
                    department=mapped.get("department"),
                    salutation=mapped.get("salutation"),
                    mailing_street=mapped.get("mailing_street"),
                    mailing_city=mapped.get("mailing_city"),
                    mailing_state=mapped.get("mailing_state"),
                    mailing_zip=mapped.get("mailing_zip"),
                    mailing_country=mapped.get("mailing_country"),
                    do_not_call=mapped.get("do_not_call", "").lower() == "true",
                    email_opt_out=mapped.get("email_opt_out", "").lower() == "true",
                    description=mapped.get("description"),
                    vtiger_id=mapped.get("vtiger_id"),
                )
                db.add(new_contact)
                created_count += 1
        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
    
    db.commit()
    
    return {
        "success": True,
        "created": created_count,
        "updated": updated_count,
        "errors": errors[:20] if errors else [],
        "total_errors": len(errors)
    }


@router.get("/template/accounts")
async def get_account_template():
    """Get CSV template for account import"""
    return {
        "columns": list(VTIGER_ACCOUNT_MAPPING.keys()),
        "sample_row": {
            "accountid": "ACC001",
            "accountname": "Örnek Firma A.Ş.",
            "phone": "+90 212 555 1234",
            "email1": "info@ornek.com",
            "website": "www.ornek.com",
            "industry": "Technology",
            "employees": "50",
            "annual_revenue": "1000000",
            "bill_street": "Atatürk Caddesi No:1",
            "bill_city": "İstanbul",
        }
    }


@router.get("/template/contacts")
async def get_contact_template():
    """Get CSV template for contact import"""
    return {
        "columns": list(VTIGER_CONTACT_MAPPING.keys()),
        "sample_row": {
            "contactid": "CON001",
            "firstname": "Ahmet",
            "lastname": "Yılmaz",
            "email": "ahmet@ornek.com",
            "phone": "+90 532 555 1234",
            "mobile": "+90 532 555 1234",
            "title": "Satın Alma Müdürü",
            "department": "Satın Alma",
            "salutation": "Mr.",
            "accountid": "ACC001",
        }
    }
