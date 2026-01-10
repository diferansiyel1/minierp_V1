from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/sales",
    tags=["sales"],
    responses={404: {"description": "Not found"}},
)

# ==================== DEALS ====================

def serialize_deal(deal):
    """Convert Deal model to dict with customer_id"""
    return {
        "id": deal.id,
        "title": deal.title,
        "source": deal.source,
        "status": deal.status,
        "probability": deal.probability,
        "estimated_value": deal.estimated_value,
        "customer_id": deal.account_id,
        "created_at": deal.created_at,
        "customer": deal.account
    }

@router.post("/deals", response_model=schemas.Deal)
def create_deal(deal: schemas.DealCreate, db: Session = Depends(get_db)):
    db_deal = models.Deal(
        title=deal.title,
        source=deal.source,
        status=deal.status,
        probability=deal.probability,
        estimated_value=deal.estimated_value,
        account_id=deal.customer_id
    )
    db.add(db_deal)
    db.commit()
    db.refresh(db_deal)
    return serialize_deal(db_deal)

@router.get("/deals", response_model=List[schemas.Deal])
def read_deals(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    deals = db.query(models.Deal).order_by(models.Deal.created_at.desc()).offset(skip).limit(limit).all()
    return [serialize_deal(d) for d in deals]


@router.get("/deals/{deal_id}", response_model=schemas.Deal)
def read_deal(deal_id: int, db: Session = Depends(get_db)):
    db_deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return serialize_deal(db_deal)

@router.put("/deals/{deal_id}", response_model=schemas.Deal)
def update_deal(deal_id: int, deal: schemas.DealCreate, db: Session = Depends(get_db)):
    db_deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    db_deal.title = deal.title
    db_deal.source = deal.source
    db_deal.status = deal.status
    db_deal.probability = deal.probability
    db_deal.estimated_value = deal.estimated_value
    db_deal.account_id = deal.customer_id
    
    db.commit()
    db.refresh(db_deal)
    return serialize_deal(db_deal)

@router.patch("/deals/{deal_id}/status", response_model=schemas.Deal)
def update_deal_status(deal_id: int, status_update: schemas.DealStatusUpdate, db: Session = Depends(get_db)):
    """Fırsat durumunu güncelle"""
    db_deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    db_deal.status = status_update.status
    db.commit()
    db.refresh(db_deal)
    return serialize_deal(db_deal)

@router.post("/deals/{deal_id}/convert-to-quote", response_model=schemas.Quote)
def convert_deal_to_quote(deal_id: int, quote_data: schemas.QuoteFromDeal, db: Session = Depends(get_db)):
    """Fırsattan teklif oluştur"""
    db_deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Check existing quotes for versioning
    existing_quotes = db.query(models.Quote).filter(models.Quote.deal_id == deal_id).count()
    version = existing_quotes + 1
    
    # Generate quote number
    quote_no = f"TKL-{datetime.now().strftime('%Y%m%d')}-{deal_id:04d}-V{version}"
    
    # Calculate totals
    subtotal = 0.0
    total_vat = 0.0
    total_discount = 0.0
    
    db_quote = models.Quote(
        quote_no=quote_no,
        deal_id=deal_id,
        account_id=db_deal.account_id,
        version=version,
        status=models.QuoteStatus.DRAFT,
        valid_until=quote_data.valid_until,
        notes=quote_data.notes
    )
    db.add(db_quote)
    db.commit()
    db.refresh(db_quote)
    
    # Add items
    for item in quote_data.items:
        line_total = item.quantity * item.unit_price
        discount = line_total * (item.discount_percent / 100)
        discounted_total = line_total - discount
        vat_amount = discounted_total * (item.vat_rate / 100)
        total_with_vat = discounted_total + vat_amount
        
        subtotal += line_total
        total_discount += discount
        total_vat += vat_amount
        
        db_item = models.QuoteItem(
            quote_id=db_quote.id,
            product_id=item.product_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount_percent=item.discount_percent,
            vat_rate=item.vat_rate,
            line_total=line_total,
            vat_amount=vat_amount,
            total_with_vat=total_with_vat
        )
        db.add(db_item)
    
    db_quote.subtotal = subtotal
    db_quote.discount_amount = total_discount
    db_quote.vat_amount = total_vat
    db_quote.total_amount = subtotal - total_discount + total_vat
    
    # Update deal status
    db_deal.status = models.DealStatus.QUOTE_SENT
    
    db.commit()
    db.refresh(db_quote)
    return db_quote

# ==================== QUOTES ====================

@router.post("/quotes", response_model=schemas.Quote)
def create_quote(quote: schemas.QuoteCreate, db: Session = Depends(get_db)):
    """Doğrudan teklif oluştur (fırsat olmadan)"""
    # Generate quote number
    quote_no = f"TKL-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    subtotal = 0.0
    total_vat = 0.0
    total_discount = 0.0
    
    db_quote = models.Quote(
        quote_no=quote.quote_no or quote_no,
        deal_id=quote.deal_id,
        account_id=quote.account_id,
        version=1,
        status=models.QuoteStatus.DRAFT,
        valid_until=quote.valid_until,
        notes=quote.notes
    )
    db.add(db_quote)
    db.commit()
    db.refresh(db_quote)
    
    for item in quote.items:
        line_total = item.quantity * item.unit_price
        discount = line_total * (item.discount_percent / 100)
        discounted_total = line_total - discount
        vat_amount = discounted_total * (item.vat_rate / 100)
        total_with_vat = discounted_total + vat_amount
        
        subtotal += line_total
        total_discount += discount
        total_vat += vat_amount
        
        db_item = models.QuoteItem(
            quote_id=db_quote.id,
            product_id=item.product_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount_percent=item.discount_percent,
            vat_rate=item.vat_rate,
            line_total=line_total,
            vat_amount=vat_amount,
            total_with_vat=total_with_vat
        )
        db.add(db_item)
    
    db_quote.subtotal = subtotal
    db_quote.discount_amount = total_discount
    db_quote.vat_amount = total_vat
    db_quote.total_amount = subtotal - total_discount + total_vat
    
    db.commit()
    db.refresh(db_quote)
    return db_quote

@router.get("/quotes", response_model=List[schemas.Quote])
def read_quotes(status: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(models.Quote)
    if status:
        query = query.filter(models.Quote.status == status)
    quotes = query.order_by(models.Quote.created_at.desc()).offset(skip).limit(limit).all()
    return quotes

@router.get("/quotes/{quote_id}", response_model=schemas.Quote)
def read_quote(quote_id: int, db: Session = Depends(get_db)):
    db_quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not db_quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return db_quote

@router.put("/quotes/{quote_id}", response_model=schemas.Quote)
def update_quote(quote_id: int, quote: schemas.QuoteUpdate, db: Session = Depends(get_db)):
    """Teklifi güncelle"""
    db_quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not db_quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Update quote fields
    if quote.account_id is not None:
        db_quote.account_id = quote.account_id
    if quote.currency is not None:
        db_quote.currency = quote.currency
    if quote.valid_until is not None:
        db_quote.valid_until = quote.valid_until
    if quote.notes is not None:
        db_quote.notes = quote.notes
    
    # Delete old items
    db.query(models.QuoteItem).filter(models.QuoteItem.quote_id == quote_id).delete()
    
    # Recalculate totals and add new items
    subtotal = 0.0
    total_vat = 0.0
    total_discount = 0.0
    
    for item in quote.items:
        line_total = item.quantity * item.unit_price
        discount = line_total * (item.discount_percent / 100)
        discounted_total = line_total - discount
        vat_amount = discounted_total * (item.vat_rate / 100)
        total_with_vat = discounted_total + vat_amount
        
        subtotal += line_total
        total_discount += discount
        total_vat += vat_amount
        
        db_item = models.QuoteItem(
            quote_id=db_quote.id,
            product_id=item.product_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount_percent=item.discount_percent,
            vat_rate=item.vat_rate,
            line_total=line_total,
            vat_amount=vat_amount,
            total_with_vat=total_with_vat
        )
        db.add(db_item)
    
    db_quote.subtotal = subtotal
    db_quote.discount_amount = total_discount
    db_quote.vat_amount = total_vat
    db_quote.total_amount = subtotal - total_discount + total_vat
    
    db.commit()
    db.refresh(db_quote)
    return db_quote

@router.patch("/quotes/{quote_id}/status")
def update_quote_status(quote_id: int, status: str, db: Session = Depends(get_db)):
    """Teklif durumunu güncelle"""
    db_quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not db_quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    db_quote.status = status
    db.commit()
    db.refresh(db_quote)
    return db_quote

@router.post("/quotes/{quote_id}/revise", response_model=schemas.Quote)
def revise_quote(quote_id: int, db: Session = Depends(get_db)):
    """Teklif revizyonu oluştur (versiyon artır)"""
    original = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Create new version
    new_version = original.version + 1
    new_quote_no = f"{original.quote_no.rsplit('-V', 1)[0]}-V{new_version}"
    
    db_quote = models.Quote(
        quote_no=new_quote_no,
        deal_id=original.deal_id,
        account_id=original.account_id,
        version=new_version,
        status=models.QuoteStatus.DRAFT,
        valid_until=original.valid_until,
        notes=original.notes,
        subtotal=original.subtotal,
        discount_amount=original.discount_amount,
        vat_amount=original.vat_amount,
        total_amount=original.total_amount
    )
    db.add(db_quote)
    db.commit()
    db.refresh(db_quote)
    
    # Copy items
    for item in original.items:
        db_item = models.QuoteItem(
            quote_id=db_quote.id,
            product_id=item.product_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount_percent=item.discount_percent,
            vat_rate=item.vat_rate,
            line_total=item.line_total,
            vat_amount=item.vat_amount,
            total_with_vat=item.total_with_vat
        )
        db.add(db_item)
    
    db.commit()
    db.refresh(db_quote)
    return db_quote

@router.post("/quotes/{quote_id}/convert-to-order")
def convert_quote_to_order(quote_id: int, db: Session = Depends(get_db)):
    """Teklifi siparişe dönüştür"""
    db_quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not db_quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Create order
    db_order = models.Order(
        deal_id=db_quote.deal_id,
        quote_id=quote_id,
        status="Created",
        total_amount=db_quote.total_amount
    )
    db.add(db_order)
    
    # Update quote status
    db_quote.status = models.QuoteStatus.ACCEPTED
    
    # Update deal status if exists
    if db_quote.deal_id:
        db_deal = db.query(models.Deal).filter(models.Deal.id == db_quote.deal_id).first()
        if db_deal:
            db_deal.status = models.DealStatus.ORDER_RECEIVED
    
    db.commit()
    db.refresh(db_order)
    
    return {"message": "Order created", "order_id": db_order.id}
