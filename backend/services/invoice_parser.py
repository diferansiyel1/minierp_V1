"""
Invoice PDF Parser Service

Türk e-fatura PDF'lerini analiz ederek yapılandırılmış veri çıkarır.

Heuristics:
- ETTN: UUID format regex
- Tarih: DD.MM.YYYY veya DD-MM-YYYY
- Tutar: "Ödenecek Tutar", "Genel Toplam" yakınındaki sayılar
- Fatura Tipi: "SAYIN: PIKOLAB" → PURCHASE, else SALES
- Proje Kodu: "Proje Kodu: [0-9]+" pattern
- Teknokent: "Kuluçka" veya "Teknoloji Geliştirme Bölgesi" keywords
"""
import re
import io
from datetime import date, datetime
from typing import Optional, List, Dict, Any, Tuple
from fastapi import UploadFile
import pdfplumber


# Regex patterns for Turkish e-invoices
ETTN_PATTERN = re.compile(
    r'[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}'
)
DATE_PATTERN = re.compile(r'(\d{2})[.\-/](\d{2})[.\-/](\d{4})')
AMOUNT_PATTERN = re.compile(r'[\d.,]+')
PROJECT_CODE_PATTERN = re.compile(r'Proje\s*Kodu\s*:?\s*(\d+)', re.IGNORECASE)

# Vergi Kimlik No (VKN) - 10 or 11 digits
VKN_PATTERN = re.compile(r'(?:VKN|V\.K\.N|Vergi\s*(?:Kimlik)?\s*No?(?:mrası)?)[:\s]*([0-9]{10,11})', re.IGNORECASE)
VKN_STANDALONE = re.compile(r'\b([0-9]{10,11})\b')

# Vergi Dairesi
TAX_OFFICE_PATTERN = re.compile(
    r'(?:Vergi\s*Dairesi|V\.D)[:\s]*([\wçğıöşüÇĞİÖŞÜ\s]+?)(?:\n|\d|VKN|Vergi|$)',
    re.IGNORECASE | re.UNICODE
)

# Keywords for amount detection
AMOUNT_KEYWORDS = [
    'ödenecek tutar',
    'genel toplam',
    'toplam tutar',
    'fatura toplamı',
    'vergiler dahil toplam',
    'net tutar',
]

# Keywords for tax amount
TAX_KEYWORDS = [
    'kdv tutarı',
    'hesaplanan kdv',
    'toplam kdv',
    'vergi tutarı',
]

# Teknokent detection keywords
TECHNOPARK_KEYWORDS = [
    'kuluçka firması',
    'kuluçka kapsamında',
    'teknoloji geliştirme bölgesi',
    'teknokent',
    'teknopark',
    'tgb',
]

# Company name for direction detection
OUR_COMPANY = 'pikolab'

# Teknokent issuer detection (for withholding tax)
TEKNOKENT_ISSUER_KEYWORDS = [
    'odtü teknokent',
    'bilkent cyberpark',
    'hacettepe teknokent', 
    'tgb yönetim',
    'teknokent a.ş',
    'teknopark a.ş',
]


def _normalize_turkish(text: str) -> str:
    """
    Normalize Turkish special characters for matching.
    
    Handles: İ→i, I→ı (but we use lowercase), Ş→s, Ğ→g, Ü→u, Ö→o, Ç→c
    Also handles combining characters from uppercase Turkish letters.
    """
    # Replace Turkish lowercase characters with ASCII equivalents
    replacements = {
        'ı': 'i',  # Turkish dotless i
        'i̇': 'i',  # i with combining dot above (from İ)
        'ş': 's',
        'ğ': 'g', 
        'ü': 'u',
        'ö': 'o',
        'ç': 'c',
        'İ': 'i',
        'Ş': 's',
        'Ğ': 'g',
        'Ü': 'u',
        'Ö': 'o',
        'Ç': 'c',
    }
    for tr_char, ascii_char in replacements.items():
        text = text.replace(tr_char, ascii_char)
    return text


def _extract_issuer_info(text: str) -> Dict[str, Optional[str]]:
    """
    Extract issuer (supplier) information from invoice text.
    
    Issuer info is typically at the top of the invoice before 'SAYIN' or 'e-Fatura'.
    """
    result = {
        'issuer_name': None,
        'issuer_tax_id': None,
        'issuer_address': None,
        'issuer_tax_office': None
    }
    
    lines = text.split('\n')
    
    # First line is usually issuer name
    if lines:
        result['issuer_name'] = lines[0].strip()
    
    # Find address lines (between name and Vergi Dairesi/SAYIN)
    addr_lines = []
    for i, line in enumerate(lines[1:30], 1):
        line_stripped = line.strip()
        if 'SAYIN' in line or 'e-Fatura' in line:
            break
        if 'Vergi Dairesi:' in line:
            parts = line.split('Vergi Dairesi:')
            if len(parts) > 1:
                result['issuer_tax_office'] = parts[1].strip()
        elif 'VKN:' in line:
            match = re.search(r'VKN:\s*(\d{10,11})', line)
            if match:
                result['issuer_tax_id'] = match.group(1)
        elif line_stripped and 'http' not in line.lower() and 'sicil' not in line.lower() \
                and 'mersis' not in line.lower() and not line_stripped.startswith('Web'):
            addr_lines.append(line_stripped)
    
    if addr_lines:
        result['issuer_address'] = ' '.join(addr_lines)
    
    return result


def _extract_customer_info(text: str) -> Dict[str, Optional[str]]:
    """
    Extract customer (receiver) information from invoice text.
    
    Customer info follows 'SAYIN' section in Turkish e-invoices.
    """
    result = {
        'customer_name': None,
        'customer_tax_id': None,
        'customer_address': None,
        'customer_tax_office': None
    }
    
    # Find the SAYIN section - extend the search area
    sayin_match = re.search(r'SAYIN\s*\n?(.+?)(?=Stok\s*Kodu|İskonto|Sıra\s*No)', text, re.DOTALL | re.IGNORECASE)
    if not sayin_match:
        # Try alternative pattern
        sayin_match = re.search(r'SAYIN\s*\n?(.+?)(?=Senaryo|Fatura Tipi|Fatura No)', text, re.DOTALL | re.IGNORECASE)
    
    if not sayin_match:
        return result
    
    customer_text = sayin_match.group(1).strip()
    cust_lines = [l.strip() for l in customer_text.split('\n') if l.strip()]
    
    # First real line (company name) - skip lines that look like metadata
    for line in cust_lines:
        if 'Özelleştirme' not in line and 'TR1' not in line and len(line) > 10:
            # Check if it looks like a company name
            if any(kw in line.upper() for kw in ['LTD', 'A.Ş', 'ŞTİ', 'SAN.', 'TİC.']):
                result['customer_name'] = line
                break
    
    # Find VKN and Vergi Dairesi in the customer section
    # All VKNs in customer section
    all_vkns = re.findall(r'VKN:\s*(\d{10,11})', customer_text)
    if all_vkns:
        result['customer_tax_id'] = all_vkns[-1]  # Last VKN in customer section is usually the customer's
    
    # Find Vergi Dairesi
    vd_match = re.search(r'Vergi\s*Dairesi:\s*([\wçğıöşüÇĞİÖŞÜ\s]+?)(?:\n|ETTN|$)', customer_text, re.IGNORECASE)
    if vd_match:
        result['customer_tax_office'] = vd_match.group(1).strip()
    
    # Address is lines that look like addresses (contain street/district names)
    addr_lines = []
    for line in cust_lines:
        if 'VKN' not in line and 'Vergi Dairesi' not in line and 'Özelleştirme' not in line:
            if 'ETTN' not in line and 'Senaryo' not in line and 'Fatura' not in line:
                if any(kw in line.upper() for kw in ['MAH', 'CAD', 'SOK', 'NO:', 'BİNASI', 'SİTESİ', 'BÖLGESI', 'İZMİR', 'ANKARA', 'İSTANBUL']):
                    addr_lines.append(line)
    
    if addr_lines:
        result['customer_address'] = ' '.join(addr_lines)
    
    return result


def _extract_totals_from_text(text: str) -> Dict[str, Optional[float]]:
    """
    Extract totals from invoice text using regex patterns.
    
    Works better than table extraction for some PDF formats.
    """
    result = {
        'gross_total': None,      # Mal Hizmet Toplam Tutarı
        'total_discount': None,   # Toplam İskonto
        'net_subtotal': None,     # KDV'siz Net Tutar
        'vat_amount': None,       # Actual KDV in TL
        'grand_total': None,      # KDV Dahil Toplam
        'payable': None           # Ödenecek Tutar
    }
    
    patterns = [
        (r'Mal\s*Hizmet\s*Toplam\s*Tutarı?\s*([\d.,]+)\s*TL', 'gross_total'),
        (r'Toplam\s*[İI]skonto\s*([\d.,]+)\s*TL', 'total_discount'),
        (r'KDV.*?siz\s*Net\s*Tutar\s*([\d.,]+)\s*TL', 'net_subtotal'),
        (r'Hesaplanan\s*(?:GERÇEK\s*USULDE\s*)?(?:KATMA\s*DEĞER\s*VERGİSİ|KDV).*?([\d.,]+)\s*TL', 'vat_amount'),
        (r'KDV\s*Dahil\s*Toplam\s*Tutar\s*([\d.,]+)\s*TL', 'grand_total'),
        (r'(?:Vergiler\s*[Dd]ahil\s*Toplam\s*Tutar|Ödenecek\s*Tutar)\s*([\d.,]+)\s*TL', 'payable'),
    ]
    
    for pattern, key in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                value_str = match.group(1).replace('.', '').replace(',', '.')
                result[key] = float(value_str)
            except (ValueError, IndexError):
                pass
    
    return result


def _verify_totals(line_items: List[Dict], extracted_totals: Dict) -> Tuple[str, List[str]]:
    """
    Verify calculated totals against extracted totals.
    
    Returns (status, notes) where status is 'verified', 'mismatch', or 'unverified'.
    """
    notes = []
    
    # Calculate from line items
    calc_net = sum(l.get('total', 0) for l in line_items)
    calc_discount = sum(l.get('discount_amount', 0) for l in line_items)
    
    # Get extracted values
    ext_net = extracted_totals.get('net_subtotal')
    ext_discount = extracted_totals.get('total_discount')
    ext_vat = extracted_totals.get('vat_amount')
    ext_payable = extracted_totals.get('payable')
    
    if ext_net is None or ext_payable is None:
        return 'unverified', ['Toplam bilgileri PDF\'den çıkarılamadı']
    
    # Verify net subtotal
    tolerance = 0.10  # 10 kuruş tolerance
    
    if abs(calc_net - ext_net) <= tolerance:
        notes.append(f'✓ Net tutar doğrulandı: {ext_net:.2f} TL')
    else:
        notes.append(f'⚠ Net tutar uyuşmuyor: Hesaplanan {calc_net:.2f} TL, PDF {ext_net:.2f} TL')
    
    if ext_discount:
        if abs(calc_discount - ext_discount) <= tolerance:
            notes.append(f'✓ İskonto doğrulandı: {ext_discount:.2f} TL')
        else:
            notes.append(f'⚠ İskonto uyuşmuyor: Hesaplanan {calc_discount:.2f} TL, PDF {ext_discount:.2f} TL')
    
    # Verify VAT + net = payable
    if ext_vat and ext_net:
        calc_payable = ext_net + ext_vat
        if abs(calc_payable - ext_payable) <= tolerance:
            notes.append(f'✓ Toplam tutar doğrulandı: {ext_payable:.2f} TL')
        else:
            notes.append(f'⚠ Toplam uyuşmuyor: Net {ext_net:.2f} + KDV {ext_vat:.2f} = {calc_payable:.2f}, PDF {ext_payable:.2f} TL')
    
    # Determine overall status
    has_mismatch = any('⚠' in n for n in notes)
    status = 'mismatch' if has_mismatch else 'verified'
    
    return status, notes


async def parse_invoice_pdf(file: UploadFile, invoice_type: str = "Purchase") -> Dict[str, Any]:
    """
    Parse a PDF invoice file and extract structured data.
    
    Specialized for Turkish e-invoice format with table classification.
    
    Args:
        file: The uploaded PDF file
        invoice_type: "Purchase" (gider) or "Sales" (gelir) - determines which account to extract
    """
    notes: List[str] = []
    lines: List[Dict[str, Any]] = []
    invoice_notes: List[str] = []  # Notes from the invoice itself
    
    # Totals for verification
    parsed_totals = {
        'subtotal': None,
        'discount': None,
        'vat': None,
        'grand_total': None,
        'payable': None
    }
    
    # Invoice metadata from table
    invoice_no = None
    invoice_date_str = None

    # Read PDF content
    content = await file.read()

    # Extract text from all pages
    full_text = ""
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            full_text += page_text + "\n"

            # Extract and classify all tables
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 1:
                    continue
                
                table_type = _classify_table(table)
                
                if table_type == 'metadata':
                    # Extract invoice number and date from metadata table
                    for row in table:
                        if len(row) >= 2:
                            label = str(row[0] or '').lower().strip()
                            value = str(row[1] or '').strip()
                            if 'fatura no' in label:
                                invoice_no = value
                            elif 'fatura tarihi' in label:
                                invoice_date_str = value
                
                elif table_type == 'line_items':
                    # Parse line items from this table
                    lines.extend(_parse_line_items_table(table))
                
                elif table_type == 'totals':
                    # Extract totals for verification
                    _extract_totals(table, parsed_totals)
                
                elif table_type == 'notes':
                    # Extract notes from the notes table
                    for row in table:
                        for cell in row:
                            if cell:
                                text = str(cell).strip()
                                if text and len(text) > 3:
                                    invoice_notes.append(text)

    text_lower = full_text.lower()

    # Extract ETTN
    ettn = _extract_ettn(full_text)
    if ettn:
        notes.append(f"ETTN tespit edildi: {ettn}")
    
    # Use invoice_no from table if no ETTN
    if not ettn and invoice_no:
        ettn = invoice_no
        notes.append(f"Fatura No: {invoice_no}")

    # Extract date
    issue_date = _extract_date(full_text)
    if issue_date:
        notes.append(f"Fatura tarihi: {issue_date.strftime('%d.%m.%Y')}")

    # Extract totals from text (more reliable than table parsing for some formats)
    text_totals = _extract_totals_from_text(full_text)
    
    # Use text totals if available, otherwise fall back to parsed table totals
    total_amount = text_totals['payable'] or parsed_totals.get('payable') or parsed_totals.get('grand_total') or _extract_amount(text_lower, AMOUNT_KEYWORDS)
    tax_amount = text_totals['vat_amount'] or parsed_totals.get('vat') or _extract_amount(text_lower, TAX_KEYWORDS)
    gross_total = text_totals['gross_total']
    total_discount = text_totals['total_discount'] or 0
    net_subtotal = text_totals['net_subtotal']

    # Verify totals against line items
    verification_status, verification_notes = _verify_totals(lines, text_totals)
    notes.extend(verification_notes)

    # Add invoice notes from tables
    for inv_note in invoice_notes:
        notes.append(inv_note)

    # Extract issuer (supplier) information
    issuer_info = _extract_issuer_info(full_text)
    
    # Extract customer (receiver) information
    customer_info = _extract_customer_info(full_text)

    # Determine invoice type (SALES vs PURCHASE)
    # Note: We use the passed-in invoice_type, but get supplier/receiver names from auto-detection
    _detected_type, supplier_name, receiver_name = _determine_invoice_direction(full_text)
    notes.append(f"Fatura tipi: {invoice_type}")
    
    # Use extracted names if available
    if issuer_info['issuer_name']:
        supplier_name = issuer_info['issuer_name']
    if customer_info['customer_name']:
        receiver_name = customer_info['customer_name']

    # Extract project code
    suggested_project_code = _extract_project_code(full_text)
    if suggested_project_code:
        notes.append(f"Proje kodu tespit edildi: {suggested_project_code}")

    # Detect Teknokent/Technopark expense
    is_technopark_expense, expense_type = _detect_technopark(text_lower)
    if is_technopark_expense:
        notes.append("Teknokent/Kuluçka gideri tespit edildi")

    # Check for VAT exemption
    vat_exempt = _detect_vat_exemption(text_lower)
    if vat_exempt:
        notes.append("KDV istisnası tespit edildi")

    return {
        # Invoice ID
        "ettn": ettn,
        "invoice_no": invoice_no,
        "issue_date": issue_date,
        
        # Issuer (Faturayı Kesen)
        "issuer_name": issuer_info['issuer_name'],
        "issuer_tax_id": issuer_info['issuer_tax_id'],
        "issuer_address": issuer_info['issuer_address'],
        "issuer_tax_office": issuer_info['issuer_tax_office'],
        
        # Customer (Alıcı)
        "customer_name": customer_info['customer_name'],
        "customer_tax_id": customer_info['customer_tax_id'],
        "customer_address": customer_info['customer_address'],
        "customer_tax_office": customer_info['customer_tax_office'],
        
        # Legacy fields (for compatibility)
        "supplier_name": supplier_name,
        "receiver_name": receiver_name,
        "tax_id": issuer_info['issuer_tax_id'] or customer_info['customer_tax_id'],
        "tax_office": issuer_info['issuer_tax_office'] or customer_info['customer_tax_office'],
        "address": issuer_info['issuer_address'] or customer_info['customer_address'],
        
        # Unified account info (based on invoice_type)
        # Purchase (gider): tedarikçi bilgileri (issuer)
        # Sales (gelir): müşteri bilgileri (customer)
        "account_info": {
            "name": issuer_info['issuer_name'] if invoice_type == "Purchase" else customer_info['customer_name'],
            "tax_id": issuer_info['issuer_tax_id'] if invoice_type == "Purchase" else customer_info['customer_tax_id'],
            "address": issuer_info['issuer_address'] if invoice_type == "Purchase" else customer_info['customer_address'],
            "tax_office": issuer_info['issuer_tax_office'] if invoice_type == "Purchase" else customer_info['customer_tax_office'],
        },
        
        # Totals
        "gross_total": gross_total,
        "total_discount": total_discount,
        "net_subtotal": net_subtotal,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
        
        # Verification
        "verification_status": verification_status,
        "verification_notes": verification_notes,
        
        # Classification
        "invoice_type": invoice_type,
        "suggested_project_code": suggested_project_code,
        "is_technopark_expense": is_technopark_expense,
        "expense_type": expense_type,
        "vat_exempt": vat_exempt,
        
        # Data
        "lines": lines,
        "notes": notes,
        "raw_text": full_text[:2000] if full_text else None,
        
        # Enhanced detection fields
        "suggested_category": expense_type if is_technopark_expense else None,
        "suggested_withholding_rate": 20 if is_technopark_expense and expense_type == "RENT" else 0,
        "suggested_expense_center": "RD_CENTER" if is_technopark_expense else None,
    }


def _classify_table(table: List[List]) -> str:
    """
    Classify a table as one of: metadata, line_items, totals, notes, unknown.
    
    Based on Turkish e-invoice table patterns.
    """
    if not table or len(table) < 1:
        return 'unknown'
    
    # Convert first row to lowercase strings for analysis
    first_row = [str(cell or '').lower().strip() for cell in table[0]]
    first_row_text = ' '.join(first_row)
    
    # Check all rows for pattern matching
    all_text = ' '.join(' '.join(str(c or '').lower() for c in row) for row in table)
    
    # Line items table: has header with "ürün", "hizmet", "miktar", "birim fiyat"
    line_item_indicators = ['ürün', 'hizmet', 'miktar', 'birim', 'sıra']
    if sum(1 for ind in line_item_indicators if ind in first_row_text) >= 2:
        return 'line_items'
    
    # Metadata table: has "fatura no", "fatura tipi", "senaryo"
    metadata_indicators = ['fatura no', 'fatura tipi', 'senaryo', 'özelleştirme']
    if any(ind in all_text for ind in metadata_indicators):
        return 'metadata'
    
    # Totals table: has "toplam", "ödenecek tutar", "kdv"
    totals_indicators = ['mal hizmet toplam', 'ödenecek tutar', 'vergiler dahil', 'toplam iskonto']
    if any(ind in all_text for ind in totals_indicators):
        return 'totals'
    
    # Notes table: usually single column with text, no numbers
    if len(table) >= 1:
        # Check if it's mostly text (not key-value pairs like metadata)
        has_single_col = all(len(row) == 1 or sum(1 for c in row if c) <= 1 for row in table)
        has_no_numbers = not any(
            _parse_number(str(c or '')) is not None 
            for row in table for c in row 
            if c and 'tl' not in str(c).lower()
        )
        if has_single_col and len(table) >= 2:
            return 'notes'
    
    return 'unknown'


def _parse_line_items_table(table: List[List]) -> List[Dict[str, Any]]:
    """
    Parse line items from a Turkish e-invoice table.
    
    Expected columns: Sıra No, Ürün/Hizmet Kodu, Ürün/Hizmet Cinsi, Miktar, 
                      Birim, Birim Fiyat, İskonto Oranı, İskonto Tutarı, 
                      Tutar, KDV Oranı, KDV Tutarı, Diğer Vergi
    """
    lines = []
    if not table or len(table) < 2:
        return lines
    
    # Get header row with Turkish normalization
    header_row = [_normalize_turkish(str(h or '').lower().strip().replace('\n', ' ')) for h in table[0]]
    
    # Map column indices by header keywords
    col_map = {
        'description': None,
        'quantity': None,
        'unit_price': None,
        'discount_rate': None,
        'discount_amount': None,
        'total': None,
        'vat_rate': None,
        'vat_amount': None
    }
    
    for i, header in enumerate(header_row):
        # Description: "Ürün / Hizmet Cinsi", "Mal Hizmet" or similar
        if 'cinsi' in header or header == 'mal hizmet' or ('urun' in header and 'hizmet' in header and 'kodu' not in header):
            col_map['description'] = i
        # Quantity: "Miktar"
        elif 'miktar' in header:
            col_map['quantity'] = i
        # Unit price: "Birim Fiyat"
        elif 'birim fiyat' in header or ('birim' in header and 'fiyat' in header):
            col_map['unit_price'] = i
        # Discount rate: "İskonto Oranı"
        elif 'iskonto orani' in header:
            col_map['discount_rate'] = i
        # Discount amount: "İskonto Tutarı"
        elif 'iskonto tutari' in header:
            col_map['discount_amount'] = i
        # Total: "Tutar" or "Mal Hizmet Tutarı"
        elif 'mal hizmet tutari' in header:
            col_map['total'] = i
        elif header == 'tutar' or (header.startswith('tutar') and 'kdv' not in header and 'iskonto' not in header):
            col_map['total'] = i
        # VAT rate: "KDV Oranı"
        elif 'kdv orani' in header:
            col_map['vat_rate'] = i
        # VAT amount: "KDV Tutarı"
        elif 'kdv tutari' in header:
            col_map['vat_amount'] = i
    
    # If description column not found, try alternative detection
    if col_map['description'] is None:
        for i, header in enumerate(header_row):
            if 'urun' in header or 'hizmet' in header:
                if 'kodu' not in header and 'no' not in header:
                    col_map['description'] = i
                    break
    
    # Parse data rows (skip header)
    for row in table[1:]:
        if not row:
            continue
        
        # Skip empty rows
        row_values = [str(c or '').strip() for c in row]
        if all(v == '' for v in row_values):
            continue
        
        line = {}
        
        # Extract description
        if col_map['description'] is not None and col_map['description'] < len(row):
            desc = str(row[col_map['description']] or '').strip()
            if desc:
                line['description'] = desc
        
        # Extract quantity - handle formats like "42,00\nAdet" or "1,00 Adet"
        if col_map['quantity'] is not None and col_map['quantity'] < len(row):
            qty_raw = str(row[col_map['quantity']] or '')
            # Extract just the number part (before any text like "Adet")
            qty_match = re.search(r'([\d.,]+)', qty_raw)
            if qty_match:
                qty = _parse_number(qty_match.group(1))
                if qty is not None:
                    line['quantity'] = qty
        
        # Extract unit price
        if col_map['unit_price'] is not None and col_map['unit_price'] < len(row):
            price = _parse_turkish_currency(row[col_map['unit_price']])
            if price is not None:
                line['unit_price'] = price
        
        # Extract total (for verification)
        if col_map['total'] is not None and col_map['total'] < len(row):
            total = _parse_turkish_currency(row[col_map['total']])
            if total is not None:
                line['total'] = total
        
        # Extract discount rate
        if col_map['discount_rate'] is not None and col_map['discount_rate'] < len(row):
            discount_str = str(row[col_map['discount_rate']] or '')
            # Extract number from e.g., "%20,00" or "20"
            discount_num = re.search(r'(\d+)', discount_str.replace(',', '.'))
            if discount_num:
                line['discount_rate'] = int(discount_num.group(1))
        
        # Extract discount amount
        if col_map['discount_amount'] is not None and col_map['discount_amount'] < len(row):
            discount = _parse_turkish_currency(row[col_map['discount_amount']])
            if discount is not None:
                line['discount_amount'] = discount
        
        # Extract VAT rate
        if col_map['vat_rate'] is not None and col_map['vat_rate'] < len(row):
            vat_str = str(row[col_map['vat_rate']] or '')
            # Extract number from e.g., "%20,00" or "20"
            vat_num = re.search(r'(\d+)', vat_str.replace(',', '.'))
            if vat_num:
                line['vat_rate'] = int(vat_num.group(1))
        
        # Only add if we have a description
        if line.get('description'):
            lines.append(line)
    
    return lines


def _extract_totals(table: List[List], totals_dict: Dict) -> None:
    """
    Extract totals from a totals table.
    
    Updates the totals_dict in place with: subtotal, discount, vat, grand_total, payable
    """
    for row in table:
        if not row or len(row) < 2:
            continue
        
        # Find the label (usually in first non-empty cell)
        label = None
        value = None
        for cell in row:
            if cell:
                text = _normalize_turkish(str(cell).lower().strip().replace('\n', ' '))
                if label is None:
                    label = text
                else:
                    # This is the value
                    value = _parse_turkish_currency(cell)
                    break
        
        if label and value is not None:
            if 'mal hizmet toplam' in label:
                totals_dict['subtotal'] = value
            elif 'toplam iskonto' in label or 'iskonto' in label:
                totals_dict['discount'] = value
            elif 'kdv' in label or 'katma deger' in label or 'vergisi' in label:
                totals_dict['vat'] = value
            elif 'vergiler dahil' in label:
                totals_dict['grand_total'] = value
            elif 'odenecek' in label:
                totals_dict['payable'] = value


def _parse_turkish_currency(value: Any) -> Optional[float]:
    """
    Parse Turkish currency format: 1.234,56TL or 1.234,56
    """
    if value is None:
        return None
    try:
        text = str(value).strip()
        # Remove TL suffix and any whitespace
        text = re.sub(r'\s*TL\s*$', '', text, flags=re.IGNORECASE)
        # Handle Turkish format: 1.234,56 (dots for thousands, comma for decimal)
        text = text.replace('.', '').replace(',', '.')
        return float(text) if text else None
    except (ValueError, TypeError):
        return None


def _extract_ettn(text: str) -> Optional[str]:
    """Extract ETTN (UUID) from invoice text."""
    match = ETTN_PATTERN.search(text)
    return match.group(0) if match else None


def _extract_date(text: str) -> Optional[date]:
    """Extract invoice date from text."""
    # Look for date near keywords first
    date_keywords = ['fatura tarihi', 'düzenleme tarihi', 'tarih']
    text_lower = text.lower()

    for keyword in date_keywords:
        idx = text_lower.find(keyword)
        if idx != -1:
            # Search in the vicinity of the keyword
            context = text[idx:idx + 50]
            match = DATE_PATTERN.search(context)
            if match:
                day, month, year = match.groups()
                try:
                    return date(int(year), int(month), int(day))
                except ValueError:
                    continue

    # Fallback: find first date in document
    match = DATE_PATTERN.search(text)
    if match:
        day, month, year = match.groups()
        try:
            return date(int(year), int(month), int(day))
        except ValueError:
            return None
    return None


def _extract_amount(text_lower: str, keywords: List[str]) -> Optional[float]:
    """Extract amount near specified keywords."""
    for keyword in keywords:
        idx = text_lower.find(keyword)
        if idx != -1:
            # Search for number after keyword
            context = text_lower[idx:idx + 100]
            # Find all number-like patterns
            numbers = re.findall(r'[\d.,]+', context)
            for num_str in numbers:
                try:
                    # Handle Turkish number format (1.234,56)
                    cleaned = num_str.replace('.', '').replace(',', '.')
                    value = float(cleaned)
                    if value > 0:
                        return value
                except ValueError:
                    continue
    return None


def _determine_invoice_direction(
    text: str,
) -> tuple[str, Optional[str], Optional[str]]:
    """
    Determine if invoice is SALES or PURCHASE based on parties.

    Returns:
        Tuple of (invoice_type, supplier_name, receiver_name)
    """
    text_lower = text.lower()

    # Look for "SAYIN:" pattern to find receiver
    sayin_match = re.search(
        r'sayın\s*:?\s*([^\n]+)', text_lower, re.IGNORECASE
    )
    receiver_context = sayin_match.group(1) if sayin_match else ""

    # If receiver contains our company name, it's a PURCHASE (we received it)
    if OUR_COMPANY in receiver_context:
        # Find sender (usually at the top/header)
        supplier_name = _extract_company_name(text, exclude=OUR_COMPANY)
        return "Purchase", supplier_name, "Pikolab"

    # If sender is our company, it's a SALES invoice
    # Check header area for our company name
    header_text = text[:500].lower()
    if OUR_COMPANY in header_text:
        receiver_name = _extract_receiver_name(text)
        return "Sales", "Pikolab", receiver_name

    # Default: assume PURCHASE if direction unclear
    return "Purchase", None, None


def _extract_company_name(
    text: str, exclude: Optional[str] = None
) -> Optional[str]:
    """Extract company name from invoice header."""
    # Look for common Turkish company suffixes
    company_pattern = re.compile(
        r'([A-ZÇĞİÖŞÜa-zçğıöşü\s]+(?:A\.?Ş\.?|LTD\.?|Ltd\.?\s*Şti\.?))',
        re.UNICODE
    )
    matches = company_pattern.findall(text[:1000])

    for match in matches:
        clean = match.strip()
        if exclude and exclude.lower() in clean.lower():
            continue
        if len(clean) > 5:
            return clean

    return None


def _extract_receiver_name(text: str) -> Optional[str]:
    """Extract receiver name from SAYIN: section."""
    sayin_match = re.search(
        r'sayın\s*:?\s*([^\n]+)', text, re.IGNORECASE
    )
    if sayin_match:
        return sayin_match.group(1).strip()[:100]
    return None


def _extract_project_code(text: str) -> Optional[str]:
    """Extract project code from invoice."""
    match = PROJECT_CODE_PATTERN.search(text)
    return match.group(1) if match else None


def _detect_technopark(text_lower: str) -> tuple[bool, Optional[str]]:
    """
    Detect if this is a Teknokent/Technopark related expense.

    Returns:
        Tuple of (is_technopark_expense, expense_type)
    """
    # Check for Teknokent issuer keywords (indicates rent invoices)
    for keyword in TEKNOKENT_ISSUER_KEYWORDS:
        if keyword in text_lower:
            return True, "RENT"
    
    # Check for general technopark keywords
    for keyword in TECHNOPARK_KEYWORDS:
        if keyword in text_lower:
            # Check for rent-related keywords
            if any(k in text_lower for k in ['kira', 'rent', 'ofis']):
                return True, "RENT"
            return True, None
    return False, None


def _detect_vat_exemption(text_lower: str) -> bool:
    """Detect VAT exemption from invoice text."""
    exemption_keywords = [
        'istisna',
        'muaf',
        'kdv\'siz',
        'kdvsiz',
        '0 kdv',
        '%0 kdv',
    ]
    return any(keyword in text_lower for keyword in exemption_keywords)


def _parse_table_lines(table: List[List]) -> List[Dict[str, Any]]:
    """
    Parse invoice line items from a table.
    
    Enhanced for Turkish e-invoice formats with multiple fallback strategies.
    """
    lines = []
    if not table or len(table) < 1:
        return lines

    # Try to identify header row
    header_row = table[0] if table else []
    header_lower = [str(h).lower().strip() if h else '' for h in header_row]
    
    # Extended Turkish e-invoice header keywords
    desc_keywords = [
        'mal hizmet', 'mal/hizmet', 'açıklama', 'ürün', 'hizmet', 
        'malın/hizmetin', 'cinsi', 'adı', 'description', 'mal'
    ]
    qty_keywords = [
        'miktar', 'adet', 'quantity', 'mkt', 'mik'
    ]
    price_keywords = [
        'birim fiyat', 'birim fiyatı', 'b.fiyat', 'b. fiyat', 
        'fiyat', 'price', 'tutar', 'birim'
    ]
    total_keywords = [
        'tutar', 'toplam', 'total', 'satır tutarı', 'net tutar'
    ]
    vat_keywords = [
        'kdv', 'vat', 'vergi', 'kdv oranı', 'oran'
    ]

    # Find column indices with extended matching
    desc_idx = _find_column_index(header_lower, desc_keywords)
    qty_idx = _find_column_index(header_lower, qty_keywords)
    price_idx = _find_column_index(header_lower, price_keywords)
    total_idx = _find_column_index(header_lower, total_keywords)
    vat_idx = _find_column_index(header_lower, vat_keywords)
    
    # Determine if first row is actually a header or data
    has_header = desc_idx is not None or qty_idx is not None or price_idx is not None
    
    # If no header detected, try smart column detection based on content
    if not has_header and len(table) >= 1:
        # Analyze first few rows to guess column types
        sample_rows = table[:min(3, len(table))]
        num_cols = max(len(row) for row in sample_rows if row) if sample_rows else 0
        
        if num_cols >= 3:
            # Common Turkish e-invoice layout:
            # Col 0: Description, Col 1: Quantity, Col 2: Unit, Col 3: Price, Col 4: VAT, Col 5: Total
            # Or simpler: Col 0: Description, Col 1: Qty, Col 2: Price, Col 3: Total
            desc_idx = 0
            
            # Find numeric columns
            numeric_cols = []
            for col_idx in range(num_cols):
                numeric_count = 0
                for row in sample_rows:
                    if row and col_idx < len(row):
                        val = str(row[col_idx] or '').strip()
                        if _parse_number(val) is not None and val:
                            numeric_count += 1
                if numeric_count >= len(sample_rows) * 0.5:
                    numeric_cols.append(col_idx)
            
            # Assign numeric columns (qty typically comes before price)
            if len(numeric_cols) >= 2:
                qty_idx = numeric_cols[0]
                price_idx = numeric_cols[1] if len(numeric_cols) > 1 else None
                total_idx = numeric_cols[-1] if len(numeric_cols) > 2 else None
            elif len(numeric_cols) == 1:
                price_idx = numeric_cols[0]
    
    # Determine starting row
    start_row = 1 if has_header else 0
    
    # Parse data rows
    for row in table[start_row:]:
        if not row:
            continue
        
        # Skip empty rows
        if all(cell is None or str(cell).strip() == '' for cell in row):
            continue
        
        # Skip total/summary rows
        row_text = ' '.join(str(c or '').lower() for c in row)
        if any(skip in row_text for skip in ['toplam', 'genel toplam', 'kdv toplam', 'ara toplam']):
            continue
        
        line = {}
        
        # Extract description
        if desc_idx is not None and desc_idx < len(row):
            desc = str(row[desc_idx] or '').strip()
            if desc and len(desc) > 1:
                line['description'] = desc
        
        # If no description column found, try to find longest text cell
        if not line.get('description'):
            for cell in row:
                cell_str = str(cell or '').strip()
                if len(cell_str) > 3 and not _parse_number(cell_str):
                    line['description'] = cell_str
                    break
        
        # Extract quantity
        if qty_idx is not None and qty_idx < len(row):
            qty = _parse_number(row[qty_idx])
            if qty is not None:
                line['quantity'] = qty
        
        # Extract unit price
        if price_idx is not None and price_idx < len(row):
            price = _parse_number(row[price_idx])
            if price is not None:
                line['unit_price'] = price
        
        # If no price but have total, use total as price with qty=1
        if not line.get('unit_price') and total_idx is not None and total_idx < len(row):
            total = _parse_number(row[total_idx])
            if total is not None:
                line['unit_price'] = total
                if not line.get('quantity'):
                    line['quantity'] = 1.0
        
        # Extract VAT rate
        if vat_idx is not None and vat_idx < len(row):
            vat_str = str(row[vat_idx] or '')
            vat_num = re.search(r'(\d+)', vat_str)
            if vat_num:
                line['vat_rate'] = int(vat_num.group(1))
        
        # Only add line if it has a description
        if line.get('description') and len(line.get('description', '')) > 1:
            lines.append(line)

    return lines


def _find_column_index(
    headers: List[str], keywords: List[str]
) -> Optional[int]:
    """Find column index matching any of the keywords."""
    for i, header in enumerate(headers):
        header_clean = header.strip()
        for keyword in keywords:
            # Exact match or contains
            if keyword == header_clean or keyword in header_clean:
                return i
    return None


def _parse_number(value: Any) -> Optional[float]:
    """Parse a number from Turkish format."""
    if value is None:
        return None
    try:
        # Handle Turkish format: 1.234,56
        cleaned = str(value).replace('.', '').replace(',', '.').strip()
        return float(cleaned) if cleaned else None
    except (ValueError, TypeError):
        return None


def _extract_vkn(text: str) -> Optional[str]:
    """Extract VKN (Vergi Kimlik No) from invoice text."""
    # First try pattern with keyword
    match = VKN_PATTERN.search(text)
    if match:
        return match.group(1)
    
    # Fallback: find standalone 10-11 digit numbers (skip phone-like ones)
    matches = VKN_STANDALONE.findall(text)
    for num in matches:
        # VKN is usually 10 or 11 digits, exclude numbers starting with 0
        if len(num) >= 10 and not num.startswith('0'):
            return num
    return None


def _extract_tax_office(text: str) -> Optional[str]:
    """Extract Vergi Dairesi from invoice text."""
    match = TAX_OFFICE_PATTERN.search(text)
    if match:
        office = match.group(1).strip()
        # Clean up common suffixes
        office = re.sub(r'\s+V\.?D\.?S?\.?M?\.?$', '', office, flags=re.IGNORECASE)
        return office.strip()[:100] if office else None
    return None


def _extract_address(text: str) -> Optional[str]:
    """Extract address from invoice text - looks for address-like patterns."""
    # Look for lines containing typical address keywords
    address_keywords = ['mah', 'sok', 'cad', 'no:', 'apt', 'kat', 'daire', 'pk', 'posta']
    
    lines = text.split('\n')
    address_lines = []
    
    for line in lines:
        line_lower = line.lower()
        # Check if line contains address keywords
        if any(kw in line_lower for kw in address_keywords):
            cleaned = line.strip()
            if 5 < len(cleaned) < 200:
                address_lines.append(cleaned)
    
    if address_lines:
        # Return first address-like line found
        return address_lines[0]
    
    return None
