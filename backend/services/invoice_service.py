"""
Invoice Service

Handles account matching/creation and stock management for imported invoices.
"""
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from .. import models


def find_or_create_account(
    db: Session,
    tax_id: Optional[str],
    title: Optional[str],
    tax_office: Optional[str] = None,
    address: Optional[str] = None,
    invoice_type: str = "Purchase"
) -> Tuple[Optional[models.Account], bool]:
    """
    Find existing account by tax_id or create a new one.
    
    Args:
        db: Database session
        tax_id: VKN (Vergi Kimlik No)
        title: Company/person name
        tax_office: Vergi Dairesi
        address: Address
        invoice_type: "Sales" or "Purchase" to determine account_type
    
    Returns:
        Tuple of (Account, is_new_account)
    """
    if not tax_id and not title:
        return None, False
    
    # Try to find by tax_id first
    if tax_id:
        existing = db.query(models.Account).filter(
            models.Account.tax_id == tax_id
        ).first()
        if existing:
            return existing, False
    
    # Try to find by title (fuzzy match)
    if title:
        # Normalize title for comparison
        title_normalized = title.lower().strip()
        existing = db.query(models.Account).filter(
            func.lower(models.Account.title).contains(title_normalized[:20])
        ).first()
        if existing:
            # Update tax_id if we found by title but didn't have tax_id
            if tax_id and not existing.tax_id:
                existing.tax_id = tax_id
                db.commit()
            return existing, False
    
    # Create new account if we have enough info
    if title:
        # Determine account type based on invoice direction
        if invoice_type == "Sales":
            account_type = models.AccountType.CUSTOMER
        else:
            account_type = models.AccountType.SUPPLIER
        
        new_account = models.Account(
            title=title,
            tax_id=tax_id,
            tax_office=tax_office,
            address=address,
            account_type=account_type,
            entity_type=models.CustomerType.CORPORATE
        )
        db.add(new_account)
        db.commit()
        db.refresh(new_account)
        return new_account, True
    
    return None, False


def find_or_create_product(
    db: Session,
    description: str,
    unit_price: Optional[float] = None,
    vat_rate: Optional[int] = None,
    quantity: float = 1.0
) -> Tuple[Optional[models.Product], bool]:
    """
    Find existing product by description or create a new one.
    
    Args:
        db: Database session
        description: Product/service description
        unit_price: Unit price
        vat_rate: VAT rate percentage
        quantity: Quantity (used for initial stock if new product)
    
    Returns:
        Tuple of (Product, is_new_product)
    """
    if not description or len(description) < 3:
        return None, False
    
    # Normalize description for search
    desc_normalized = description.lower().strip()[:50]
    
    # Try to find existing product by name
    existing = db.query(models.Product).filter(
        func.lower(models.Product.name).contains(desc_normalized[:20])
    ).first()
    
    if existing:
        return existing, False
    
    # Generate unique code
    last_product = db.query(models.Product).order_by(
        models.Product.id.desc()
    ).first()
    next_id = (last_product.id + 1) if last_product else 1
    code = f"PRD-{next_id:04d}"
    
    # Create new product
    new_product = models.Product(
        name=description[:100],
        code=code,
        unit_price=unit_price or 0.0,
        vat_rate=vat_rate or 20,
        unit="Adet",
        product_type=models.ProductType.SERVICE,
        stock_quantity=0.0
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product, True


def update_stock(
    db: Session,
    product_id: int,
    quantity: float,
    invoice_type: str
) -> Optional[float]:
    """
    Update product stock based on invoice type.
    
    - Purchase invoice: increase stock (+)
    - Sales invoice: decrease stock (-)
    
    Args:
        db: Database session
        product_id: Product ID
        quantity: Quantity to adjust
        invoice_type: "Sales" or "Purchase"
    
    Returns:
        New stock quantity or None if product not found
    """
    product = db.query(models.Product).filter(
        models.Product.id == product_id
    ).first()
    
    if not product:
        return None
    
    # Goods products track stock
    if product.product_type == models.ProductType.GOODS.value:
        if invoice_type == "Purchase":
            product.stock_quantity += quantity
        elif invoice_type == "Sales":
            product.stock_quantity -= quantity
        
        db.commit()
        return product.stock_quantity
    
    return product.stock_quantity


def suggest_account_from_parsed_data(
    db: Session,
    tax_id: Optional[str],
    supplier_name: Optional[str],
    receiver_name: Optional[str],
    invoice_type: str
) -> Tuple[Optional[models.Account], str]:
    """
    Suggest an account based on parsed invoice data.
    
    Args:
        db: Database session
        tax_id: Extracted VKN
        supplier_name: Extracted supplier name
        receiver_name: Extracted receiver name  
        invoice_type: "Sales" or "Purchase"
    
    Returns:
        Tuple of (suggested_account, match_type)
        match_type: "tax_id", "name", or "new"
    """
    # Determine which name to use based on invoice type
    company_name = supplier_name if invoice_type == "Purchase" else receiver_name
    
    if tax_id:
        existing = db.query(models.Account).filter(
            models.Account.tax_id == tax_id
        ).first()
        if existing:
            return existing, "tax_id"
    
    if company_name:
        name_normalized = company_name.lower().strip()[:30]
        existing = db.query(models.Account).filter(
            func.lower(models.Account.title).contains(name_normalized[:15])
        ).first()
        if existing:
            return existing, "name"
    
    return None, "new"
