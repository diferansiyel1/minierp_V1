from fastapi.testclient import TestClient
from backend import models, schemas
from sqlalchemy.orm import Session

def test_create_tenant(client: TestClient, admin_token_headers):
    response = client.post(
        "/tenants",
        headers=admin_token_headers,
        json={"name": "New Tenant", "slug": "new-tenant", "is_active": True}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Tenant"
    assert data["slug"] == "new-tenant"
    assert data["id"] is not None

def test_contact_quotes(client: TestClient, token_headers, db: Session, test_user):
    # Setup data
    # Create Account
    account = models.Account(title="Test Account", tenant_id=test_user.tenant_id)
    db.add(account)
    db.commit()
    
    # Create Contact
    contact = models.Contact(
        first_name="John", 
        last_name="Doe", 
        account_id=account.id, 
        tenant_id=test_user.tenant_id
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    
    # Create Deal
    deal = models.Deal(
        title="Test Deal", 
        account_id=account.id, 
        tenant_id=test_user.tenant_id
    )
    db.add(deal)
    db.commit()
    
    # Create Quote linked to Contact
    quote = models.Quote(
        quote_no="TEST-Q-001",
        account_id=account.id,
        contact_id=contact.id,
        deal_id=deal.id,
        tenant_id=test_user.tenant_id,
        status="Draft",
        valid_until=None,
        notes="Test Note"
    )
    db.add(quote)
    db.commit()
    
    # Test API
    response = client.get(
        f"/contacts/{contact.id}/quotes",
        headers=token_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["quote_no"] == "TEST-Q-001"
    assert data[0]["contact_id"] == contact.id

def test_create_quote_atomic(client: TestClient, token_headers, db: Session, test_user):
    # Setup Account, Contact, Deal
    account = models.Account(title="Atomic Account", tenant_id=test_user.tenant_id)
    db.add(account)
    db.flush()
    
    contact = models.Contact(first_name="Jane", last_name="Doe", account_id=account.id, tenant_id=test_user.tenant_id)
    db.add(contact)
    db.flush()
    
    deal = models.Deal(title="Atomic Deal", account_id=account.id, tenant_id=test_user.tenant_id)
    db.add(deal)
    db.flush()
    
    product = models.Product(name="Widget", code="WDG", unit_price=20, vat_rate=18, unit="Adet", tenant_id=test_user.tenant_id)
    db.add(product)
    db.commit()
    
    # Test Create Quote via API
    # Since generate_quote_number uses system settings, it should work.
    
    quote_data = {
        "deal_id": deal.id,
        "account_id": account.id,
        "contact_id": contact.id,
        "valid_until": "2024-12-31T23:59:59",
        "notes": "Atomic Test",
        "items": [
            {
                "product_id": product.id,
                "description": "Widget",
                "quantity": 2,
                "unit_price": 20.0,
                "vat_rate": 18,
                "discount_percent": 0
            }
        ]
    }
    
    response = client.post(
        "/sales/quotes",
        headers=token_headers,
        json=quote_data
    )
    assert response.status_code == 200
    data = response.json()
    assert data["quote_no"] is not None
    assert data["total_amount"] > 0
    # Check DB
    quote_in_db = db.query(models.Quote).filter(models.Quote.id == data["id"]).first()
    assert quote_in_db is not None
    assert quote_in_db.contact_id == contact.id

def test_quote_fails_without_contact(client: TestClient, token_headers, db: Session, test_user):
    account = models.Account(title="No Contact Account", tenant_id=test_user.tenant_id)
    db.add(account)
    db.commit()
    
    deal = models.Deal(title="No Contact Deal", account_id=account.id, tenant_id=test_user.tenant_id)
    db.add(deal)
    db.commit()

    quote_data = {
        "deal_id": deal.id,
        "account_id": account.id,
        # contact_id missing
        "valid_until": "2024-12-31T23:59:59",
        "notes": "Fail Test",
        "items": []
    }
    
    response = client.post(
        "/sales/quotes",
        headers=token_headers,
        json=quote_data
    )
    # Validate Validation Error (422)
    assert response.status_code == 422
