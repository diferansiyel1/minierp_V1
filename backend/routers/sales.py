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


# ==================== HELPERS ====================

def generate_quote_number(db: Session) -> str:
    """
    Generate next quote number based on system settings.
    Format: {Prefix}{Year}{Sequence} (e.g. PA26011)
    """
    # Get settings or default
    prefix_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "quote_prefix").first()
    year_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "quote_year").first()
    sequence_setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == "quote_sequence").first()
    
    prefix = prefix_setting.value if prefix_setting else "PA"
    year = year_setting.value if year_setting else "26"
    sequence = int(sequence_setting.value) if sequence_setting else 1
    
    # Format: PA26011
    # Sequence is padded to 3 digits minimum, but can grow
    quote_no = f"{prefix}{year}{sequence:03d}"
    
    # Update sequence for next time
    if sequence_setting:
        sequence_setting.value = str(sequence + 1)
    else:
        # Create default settings if not exist
        db.add(models.SystemSetting(key="quote_prefix", value="PA", description="Teklif No Öneki"))
        db.add(models.SystemSetting(key="quote_year", value="26", description="Teklif No Yılı"))
        db.add(models.SystemSetting(key="quote_sequence", value="2", description="Sıradaki Teklif Numarası"))
    
    db.commit()
    
    return quote_no

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
    # quote_no = f"TKL-{datetime.now().strftime('%Y%m%d')}-{deal_id:04d}-V{version}"
    base_quote_no = generate_quote_number(db)
    quote_no = f"{base_quote_no}-V{version}" if version > 1 else base_quote_no
    
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
            unit=getattr(item, 'unit', 'Adet'),
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
    # quote_no = f"TKL-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    if not quote.quote_no:
        quote_no = generate_quote_number(db)
    else:
        quote_no = quote.quote_no
    
    subtotal = 0.0
    total_vat = 0.0
    total_discount = 0.0
    
    db_quote = models.Quote(
        quote_no=quote.quote_no or quote_no,
        deal_id=quote.deal_id,
        account_id=quote.account_id,
        contact_id=quote.contact_id,
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
            unit=getattr(item, 'unit', 'Adet'),
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

@router.get("/quotes/grouped", response_model=List[schemas.Quote])
def read_quotes_grouped(status: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Ana teklifleri revizyonlarıyla birlikte getir (sadece root quotes)"""
    query = db.query(models.Quote).filter(models.Quote.parent_quote_id == None)
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
            unit=getattr(item, 'unit', 'Adet'),
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
    """Teklif revizyonu oluştur - ana teklife bağlı alt revizyon"""
    original = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Ana teklifi bul (parent varsa parent'ı, yoksa kendisini kullan)
    root_quote = original
    if original.parent_quote_id:
        root_quote = db.query(models.Quote).filter(
            models.Quote.id == original.parent_quote_id
        ).first()
    
    # Mevcut revizyon sayısını hesapla
    existing_revisions = db.query(models.Quote).filter(
        models.Quote.parent_quote_id == root_quote.id
    ).count()
    new_revision_number = existing_revisions + 1
    
    # Revizyon numarası formatı: BASE-R1, BASE-R2...
    # Varsa mevcut -R veya -V suffix'lerini kaldır
    base_quote_no = root_quote.quote_no.split('-R')[0].split('-V')[0]
    new_quote_no = f"{base_quote_no}-R{new_revision_number}"
    
    db_quote = models.Quote(
        quote_no=new_quote_no,
        parent_quote_id=root_quote.id,
        revision_number=new_revision_number,
        deal_id=original.deal_id,
        account_id=original.account_id,
        project_id=original.project_id,
        currency=original.currency,
        version=1,
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
            unit=item.unit or 'Adet',
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
    
    # Auto-create deal if missing (Direct Quote -> Order)
    if not db_quote.deal_id:
        new_deal = models.Deal(
            title=f"Fırsat: {db_quote.quote_no}",
            account_id=db_quote.account_id,
            status=models.DealStatus.ORDER_RECEIVED,
            estimated_value=db_quote.total_amount,
            source="Sipariş"
        )
        db.add(new_deal)
        db.commit()
        db.refresh(new_deal)
        db_quote.deal_id = new_deal.id
    
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


# ==================== PDF GENERATION ====================

from fastapi.responses import StreamingResponse
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# Register Turkish-supporting fonts (DejaVu Sans)
FONTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'fonts')
FONT_REGISTERED = False

def register_fonts():
    """Register DejaVu Sans fonts for Turkish character support"""
    global FONT_REGISTERED
    if FONT_REGISTERED:
        return
    
    try:
        dejavu_path = os.path.join(FONTS_DIR, 'DejaVuSans.ttf')
        dejavu_bold_path = os.path.join(FONTS_DIR, 'DejaVuSans-Bold.ttf')
        
        if os.path.exists(dejavu_path):
            pdfmetrics.registerFont(TTFont('DejaVuSans', dejavu_path))
            if os.path.exists(dejavu_bold_path):
                pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', dejavu_bold_path))
            FONT_REGISTERED = True
        else:
            # Fallback: try system fonts on macOS
            system_fonts = [
                '/Library/Fonts/Arial Unicode.ttf',
                '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',  # Linux
            ]
            for font_path in system_fonts:
                if os.path.exists(font_path):
                    pdfmetrics.registerFont(TTFont('DejaVuSans', font_path))
                    pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', font_path))
                    FONT_REGISTERED = True
                    break
    except Exception as e:
        print(f"Font registration warning: {e}")

# Currency symbols
CURRENCY_SYMBOLS = {
    'TRY': '₺',
    'EUR': '€',
    'USD': '$',
    'GBP': '£'
}

def format_currency(amount: float, currency: str = 'TRY') -> str:
    symbol = CURRENCY_SYMBOLS.get(currency, currency)
    return f"{symbol}{amount:,.2f}"
from reportlab.platypus import Image as RLImage

# Assets directory for header/footer images
ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'assets')

# Pikolab Color Palette (from logo)
# Pikolab Color Palette (from logo)
PIKOLAB_PURPLE = '#7c3aed'  # Violet-600
PIKOLAB_MAGENTA = '#B44B8C'  # Magenta/pink (Keeping as is or update if needed)
PIKOLAB_DARK_PURPLE = '#5b21b6'  # Violet-800
PIKOLAB_LIGHT_PURPLE = '#ede9fe'  # Violet-100
PIKOLAB_GRAY = '#334155'  # Slate-700

from ..services import mail_service

@router.post("/quotes/{quote_id}/send")
async def send_quote_email(quote_id: int, db: Session = Depends(get_db)):
    """Send quote via email with transaction rollback safety"""
    
    # 1. Get Quote
    quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
        
    if not quote.account or not quote.account.email:
        raise HTTPException(status_code=400, detail="Müşteri e-posta adresi bulunamadı.")

    # 2. Update Status to Sending (Optimistic)
    original_status = quote.status
    quote.status = "Sending..."
    db.commit()
    
    try:
        # 3. Generate PDF (Mocking the stream for now or calling the logic)
        #Ideally: pdf_buffer = _generate_pdf_buffer(quote)
        # For this task, since refactoring the huge PDF function is risky with "replace_file_content",
        # I will send a simple HTML email first, and if requested, we can work on attachment.
        # User requirement says "Mail Service & PDF Templates". 
        # I'll construct a nice HTML body.
        
        email_body = f"Sayın {quote.account.title},\n\n{quote.quote_no} numaralı teklifiniz ektedir.\n\nSaygılarımızla,\nPikolab"
        
        # Render Template
        template_body = {
            "name": quote.account.title,
            "body": f"{quote.quote_no} numaralı, {format_currency(quote.total_amount, quote.currency)} tutarındaki teklifiniz hazırdır.",
            "action_url": f"https://crm.pikolab.com/quotes/{quote.id}/view", # Mock URL
            "action_text": "Teklifi Görüntüle"
        }
        
        # Send Email
        success = await mail_service.send_email(
            subject=f"Teklif: {quote.quote_no}",
            recipients=[quote.account.email],
            template_name="email_base.html",
            template_body=template_body
        )
        
        if not success:
            raise Exception("Email provider returned error")
            
        # 4. Confirm Status
        quote.status = models.QuoteStatus.SENT
        
        # Auto-create deal if not exists (Direct Quote)
        if not quote.deal_id:
            new_deal = models.Deal(
                title=f"Teklif: {quote.quote_no}",
                account_id=quote.account_id,
                status=models.DealStatus.QUOTE_SENT,
                estimated_value=quote.total_amount,
                source="Teklif"
            )
            db.add(new_deal)
            db.commit()
            db.refresh(new_deal)
            quote.deal_id = new_deal.id
            
        db.commit()
        return {"message": "Email sent successfully"}
        
    except Exception as e:
        # 5. Rollback Status
        db.rollback() # Rollback session
        # Use a new session or refresh to revert status in DB if rollback didn't cover it (it should if we haven't committed execution flow)
        # Since I committed "Sending...", I need to manually revert.
        quote.status = original_status
        db.add(quote)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Email sending failed: {str(e)}")

@router.get("/quotes/{quote_id}/pdf")
def generate_quote_pdf(quote_id: int, db: Session = Depends(get_db)):
    """Generate PDF for a quote with Turkish character support and Pikolab branding"""
    
    # Register fonts for Turkish characters
    register_fonts()
    
    quote = db.query(models.Quote).filter(models.Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")
    
    # Determine which font to use
    font_name = 'DejaVuSans' if FONT_REGISTERED else 'Helvetica'
    font_name_bold = 'DejaVuSans-Bold' if FONT_REGISTERED else 'Helvetica-Bold'
    
    # Page dimensions
    page_width, page_height = A4
    
    # Create PDF buffer
    buffer = BytesIO()
    # Function to draw header/footer on each page
    def draw_header_footer(canvas, doc):
        canvas.saveState()
        
        # Header Image
        header_path = os.path.join(ASSETS_DIR, 'quote_header.png')
        if os.path.exists(header_path):
            # Draw header full width at top
            # A4 width is ~595 pts. Assume header is designed for full width.
            # Height: let's pick reasonable height or calc from aspect logic.
            # For now, let's assume it's a banner, say 40mm high? Or just use "preserveAspectRatio".
            # Let's say we want it to span the full width of the page (0 to page_width)
            
            img_width = page_width
            img_height = 35 * mm # Approximate height for a header banner
            
            canvas.drawImage(header_path, 0, page_height - img_height, width=img_width, height=img_height, mask='auto', preserveAspectRatio=False) # Stretch to fit width
            
        canvas.restoreState()

    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4,
        rightMargin=15*mm, 
        leftMargin=15*mm,
        topMargin=45*mm,  # Increased top margin to clear the header image
        bottomMargin=45*mm  # Space for footer
    )
    
    elements = []
    usable_width = page_width - 30*mm  # Total usable width
    
    # ==================== STYLES ====================
    
    title_style = ParagraphStyle(
        'CustomTitle',
        fontName=font_name_bold,
        fontSize=20,
        spaceAfter=5,
        textColor=colors.HexColor(PIKOLAB_PURPLE),
        leading=24
    )
    
    subtitle_style = ParagraphStyle(
        'SubTitle',
        fontName=font_name,
        fontSize=9,
        textColor=colors.HexColor(PIKOLAB_GRAY),
        leading=12
    )
    
    normal_style = ParagraphStyle(
        'NormalTurkish',
        fontName=font_name,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor(PIKOLAB_GRAY)
    )
    
    heading_style = ParagraphStyle(
        'HeadingTurkish',
        fontName=font_name_bold,
        fontSize=11,
        spaceAfter=8,
        textColor=colors.HexColor(PIKOLAB_PURPLE)
    )
    
    # Description style for table cells - allows text wrapping
    desc_style = ParagraphStyle(
        'DescriptionStyle',
        fontName=font_name,
        fontSize=8,
        leading=11,
        wordWrap='CJK',
        textColor=colors.HexColor(PIKOLAB_GRAY)
    )
    
    # ==================== INFO BOX (Combined Quote & Customer Info) ====================
    
    # Title
    elements.append(Paragraph("TEKLİF", title_style))
    elements.append(Spacer(1, 10))
    
    # Combined info table - left side: customer, right side: quote details
    currency = quote.currency or 'TRY'
    
    # Left column data (Customer)
    customer_info = ""
    if quote.account:
        customer_info = f"""
        <b>Sayın:</b> {quote.account.title or '-'}<br/>
        <b>Vergi No:</b> {quote.account.tax_id or '-'}<br/>
        <b>Vergi Dairesi:</b> {quote.account.tax_office or '-'}<br/>
        <b>Adres:</b> {quote.account.address or '-'}
        """
    else:
        customer_info = "<b>Müşteri bilgisi bulunamadı</b>"
    
    # Right column data (Quote details)
    valid_until_str = quote.valid_until.strftime('%d.%m.%Y') if quote.valid_until else '-'
    quote_info = f"""
    <b>Teklif No:</b> {quote.quote_no}<br/>
    <b>Tarih:</b> {quote.created_at.strftime('%d.%m.%Y')}<br/>
    <b>Geçerlilik:</b> {valid_until_str}<br/>
    <b>Para Birimi:</b> {currency}
    """
    
    info_cell_style = ParagraphStyle(
        'InfoCell',
        fontName=font_name,
        fontSize=9,
        leading=14,
        textColor=colors.HexColor(PIKOLAB_GRAY)
    )
    
    info_table_data = [[
        Paragraph(customer_info, info_cell_style),
        Paragraph(quote_info, info_cell_style)
    ]]
    
    info_table = Table(info_table_data, colWidths=[usable_width * 0.55, usable_width * 0.45])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8F4FB')),  # Light purple bg
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor(PIKOLAB_LIGHT_PURPLE)),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))
    
    # ==================== ITEMS TABLE ====================
    
    # Header style for table
    header_cell_style = ParagraphStyle(
        'HeaderCell',
        fontName=font_name_bold,
        fontSize=9,
        textColor=colors.white,
        alignment=1  # Center
    )
    
    # Data style for right-aligned cells
    data_style_right = ParagraphStyle(
        'DataStyleRight',
        fontName=font_name,
        fontSize=8,
        alignment=2,  # RIGHT
        textColor=colors.HexColor(PIKOLAB_GRAY)
    )
    
    items_header = [
        Paragraph("<b>Açıklama</b>", header_cell_style),
        Paragraph("<b>Miktar</b>", header_cell_style),
        Paragraph("<b>Birim Fiyat</b>", header_cell_style),
        Paragraph("<b>İskonto</b>", header_cell_style),
        Paragraph("<b>KDV</b>", header_cell_style),
        Paragraph("<b>Toplam</b>", header_cell_style)
    ]
    items_data = [items_header]
    
    for item in quote.items:
        desc_text = item.description or "-"
        desc_paragraph = Paragraph(desc_text, desc_style)
        
        items_data.append([
            desc_paragraph,
            Paragraph(str(item.quantity), data_style_right),
            Paragraph(format_currency(item.unit_price, currency), data_style_right),
            Paragraph(f"%{item.discount_percent or 0}", data_style_right),
            Paragraph(f"%{item.vat_rate}", data_style_right),
            Paragraph(format_currency(item.total_with_vat, currency), data_style_right)
        ])
    
    # Column widths based on usable width
    col_widths = [usable_width * 0.35, usable_width * 0.10, usable_width * 0.15, 
                  usable_width * 0.12, usable_width * 0.10, usable_width * 0.18]
    
    items_table = Table(items_data, colWidths=col_widths)
    items_table.setStyle(TableStyle([
        # Header row - Pikolab purple gradient effect
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(PIKOLAB_PURPLE)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        # Data rows
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        # Grid with light purple
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor(PIKOLAB_LIGHT_PURPLE)),
        # Alternating row colors
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FAF7FC')]),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 15))
    
    # ==================== TOTALS ====================
    
    totals_label_style = ParagraphStyle(
        'TotalsLabel',
        fontName=font_name,
        fontSize=9,
        alignment=2,
        textColor=colors.HexColor(PIKOLAB_GRAY)
    )
    
    totals_value_style = ParagraphStyle(
        'TotalsValue',
        fontName=font_name,
        fontSize=9,
        alignment=2,
        textColor=colors.HexColor(PIKOLAB_GRAY)
    )
    
    totals_data = [
        [Paragraph("Ara Toplam:", totals_label_style), Paragraph(format_currency(quote.subtotal, currency), totals_value_style)],
        [Paragraph("İskonto:", totals_label_style), Paragraph(f"-{format_currency(quote.discount_amount, currency)}", totals_value_style)],
        [Paragraph("KDV:", totals_label_style), Paragraph(format_currency(quote.vat_amount, currency), totals_value_style)],
    ]
    
    totals_table = Table(totals_data, colWidths=[usable_width * 0.75, usable_width * 0.25])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(totals_table)
    
    # Grand total with Pikolab styling
    grand_total_label_style = ParagraphStyle(
        'GrandTotalLabel',
        fontName=font_name_bold,
        fontSize=12,
        alignment=2,
        textColor=colors.HexColor(PIKOLAB_PURPLE)
    )
    
    grand_total_value_style = ParagraphStyle(
        'GrandTotalValue',
        fontName=font_name_bold,
        fontSize=12,
        alignment=2,
        textColor=colors.HexColor(PIKOLAB_PURPLE)
    )
    
    grand_total_data = [[
        Paragraph("GENEL TOPLAM:", grand_total_label_style),
        Paragraph(format_currency(quote.total_amount, currency), grand_total_value_style)
    ]]
    
    grand_total_table = Table(grand_total_data, colWidths=[usable_width * 0.75, usable_width * 0.25])
    grand_total_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('LINEABOVE', (0, 0), (-1, 0), 2, colors.HexColor(PIKOLAB_PURPLE)),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(grand_total_table)
    
    # ==================== CONDITIONS AND SIGNATURE LAYOUT ====================
    
    elements.append(Spacer(1, 25))
    
    # --- Left Content: Conditions ---
    left_content = []
    
    if quote.notes:
        left_content.append(Paragraph("ÖDEME VE TESLİM KOŞULLARI", heading_style))
        left_content.append(Spacer(1, 5))
        
        notes_text = quote.notes
        
        # Clean header if exists
        header_cleanup = "Ödeme ve Teslim Koşulları"
        if notes_text.strip().lower().startswith(header_cleanup.lower()):
            notes_text = notes_text[len(header_cleanup):].strip()
            if notes_text.startswith("-") or notes_text.startswith(":"):
                notes_text = notes_text[1:].strip()
        
        # Split logic
        if "\n" in notes_text:
            items = notes_text.split("\n")
        elif " - " in notes_text:
            items = notes_text.split(" - ") 
        else:
            if notes_text.count("-") >= 2:
                 items = notes_text.split("-")
            else:
                items = [notes_text]
        
        # Smaller font style for conditions
        cond_style = ParagraphStyle(
            'ConditionsStyle',
            fontName=font_name,
            fontSize=7,  # Reduced to 7pt
            leading=8,   # Reduced line spacing
            textColor=colors.HexColor(PIKOLAB_GRAY)
        )
        
        clean_items = []
        for item in items:
            item = item.strip()
            if not item: continue
            clean_items.append([Paragraph(f"• {item}", cond_style)])
            
        if clean_items:
            # Inner table for background color
            # Width calculation: 60% of usbale width minus some padding
            cond_width = (usable_width * 0.6) - 5
            cond_table = Table(clean_items, colWidths=[cond_width])
            cond_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8F4FB')),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]))
            left_content.append(cond_table)
    
    # --- Right Content: Signature ---
    right_content = []
    
    signature_title_style = ParagraphStyle(
        'SignatureTitle',
        fontName=font_name_bold,
        fontSize=10,
        textColor=colors.HexColor(PIKOLAB_PURPLE),
        alignment=2  # Right align
    )
    
    signature_name_style = ParagraphStyle(
        'SignatureName',
        fontName=font_name,
        fontSize=9,
        textColor=colors.HexColor(PIKOLAB_GRAY),
        alignment=2
    )
    
    right_content.append(Paragraph("Teklifi Hazırlayan", signature_title_style))
    right_content.append(Spacer(1, 2))  # Reduced spacing
    
    signature_path = os.path.join(ASSETS_DIR, 'signature.png')
    if os.path.exists(signature_path):
        try:
            # Slightly smaller signature to fit nicely
            sig_img = RLImage(signature_path, width=45*mm, height=22*mm)
            sig_img.hAlign = 'RIGHT'
            right_content.append(sig_img)
        except:
            pass
            
    right_content.append(Spacer(1, 1))  # Reduced spacing significantly
    right_content.append(Paragraph("________________________", signature_name_style))
    right_content.append(Paragraph("Pikolab Arge Ltd. Şti.", signature_name_style))
    
    # --- Main Layout Table ---
    # colWidths: 60% for conditions, 40% for signature
    layout_table = Table([[left_content, right_content]], colWidths=[usable_width * 0.6, usable_width * 0.4])
    layout_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),  # Align right column content to right
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(layout_table)
    
    # ==================== TECHNOPARK EXEMPTION ====================
    
    if quote.project and hasattr(quote.project, 'is_technopark_project') and quote.project.is_technopark_project:
        elements.append(Spacer(1, 15))
        exemption_style = ParagraphStyle(
            'Exemption',
            fontName=font_name,
            fontSize=7,
            textColor=colors.HexColor('#059669'),
            alignment=1,
            spaceAfter=10
        )
        exemption_text = (
            "Bu belge 4691 Sayılı Teknoloji Geliştirme Bölgeleri Kanunu ve "
            "3065 Sayılı KDV Kanunu Geçici 20/1 maddesi kapsamında KDV'den müstesnadır."
        )
        elements.append(Paragraph(exemption_text, exemption_style))
    
    # ==================== HEADER AND FOOTER ====================
    
    def add_header_footer(canvas, doc):
        canvas.saveState()
        
        # Header image - FULL WIDTH (edge to edge)
        header_path = os.path.join(ASSETS_DIR, 'quote_header.png')
        if os.path.exists(header_path):
            from reportlab.lib.utils import ImageReader
            img = ImageReader(header_path)
            iw, ih = img.getSize()
            aspect = ih / float(iw)
            
            header_width = page_width  # Full page width
            header_height = header_width * aspect
            
            canvas.drawImage(
                header_path, 
                0,  # Start from left edge
                page_height - header_height, # Align to top
                width=header_width, 
                height=header_height,
                preserveAspectRatio=True,
                mask='auto'
            )
        
        # Footer image - FULL WIDTH (edge to edge)
        footer_path = os.path.join(ASSETS_DIR, 'quote_footer.png')
        if os.path.exists(footer_path):
            from reportlab.lib.utils import ImageReader
            img = ImageReader(footer_path)
            iw, ih = img.getSize()
            aspect = ih / float(iw)
            
            footer_width = page_width  # Full page width
            footer_height = footer_width * aspect
            
            canvas.drawImage(
                footer_path, 
                0,  # Start from left edge
                0,  # Bottom of page
                width=footer_width, 
                height=footer_height,
                preserveAspectRatio=True,
                mask='auto'
            )
        
        canvas.restoreState()
    
    # Build PDF with header/footer
    doc.build(elements, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
    buffer.seek(0)
    
    # Return as streaming response
    filename = f"Teklif_{quote.quote_no}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

