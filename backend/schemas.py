from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from enum import Enum

# Enums
class CustomerType(str, Enum):
    INDIVIDUAL = "Individual"
    CORPORATE = "Corporate"

class AccountType(str, Enum):
    CUSTOMER = "Customer"
    SUPPLIER = "Supplier"
    BOTH = "Both"

class InvoiceType(str, Enum):
    SALES = "Sales"
    PURCHASE = "Purchase"

class Currency(str, Enum):
    TRY = "TRY"
    EUR = "EUR"
    USD = "USD"
    GBP = "GBP"

class DealStatus(str, Enum):
    LEAD = "Lead"
    OPPORTUNITY = "Opportunity"
    QUOTE_SENT = "Quote Sent"
    NEGOTIATION = "Negotiation"
    ORDER_RECEIVED = "Order Received"
    INVOICED = "Invoiced"
    LOST = "Lost"

class QuoteStatus(str, Enum):
    DRAFT = "Draft"
    SENT = "Sent"
    ACCEPTED = "Accepted"
    REJECTED = "Rejected"
    EXPIRED = "Expired"

class TransactionType(str, Enum):
    SALES_INVOICE = "Sales Invoice"
    PURCHASE_INVOICE = "Purchase Invoice"
    COLLECTION = "Collection"
    PAYMENT = "Payment"

# Account
class AccountBase(BaseModel):
    account_type: AccountType = AccountType.CUSTOMER
    entity_type: CustomerType = CustomerType.CORPORATE
    title: str
    tax_id: Optional[str] = None
    tax_office: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class AccountCreate(AccountBase):
    pass

class Account(AccountBase):
    id: int
    receivable_balance: float = 0.0
    payable_balance: float = 0.0

    class Config:
        from_attributes = True

# Alias for backward compatibility
CustomerBase = AccountBase
CustomerCreate = AccountCreate
Customer = Account

# Product
class ProductBase(BaseModel):
    name: str
    code: str
    unit_price: float
    vat_rate: int
    unit: str

class ProductCreate(ProductBase):
    pass

class Product(ProductBase):
    id: int

    class Config:
        from_attributes = True

# Deal
class DealBase(BaseModel):
    title: str
    source: Optional[str] = None
    status: DealStatus = DealStatus.LEAD
    probability: float = 0.0
    estimated_value: float = 0.0
    customer_id: int

class DealCreate(DealBase):
    pass

class DealStatusUpdate(BaseModel):
    status: DealStatus

class Deal(BaseModel):
    id: int
    title: str
    source: Optional[str] = None
    status: DealStatus
    probability: float = 0.0
    estimated_value: float = 0.0
    customer_id: Optional[int] = None
    created_at: datetime
    customer: Optional[Account] = None

    class Config:
        from_attributes = True

# Quote Item
class QuoteItemBase(BaseModel):
    product_id: Optional[int] = None
    description: str
    quantity: float
    unit_price: float
    discount_percent: float = 0.0
    vat_rate: int

class QuoteItemCreate(QuoteItemBase):
    pass

class QuoteItem(QuoteItemBase):
    id: int
    line_total: float
    vat_amount: float
    total_with_vat: float
    product: Optional[Product] = None
    
    class Config:
        from_attributes = True

# Quote
class QuoteBase(BaseModel):
    deal_id: Optional[int] = None
    account_id: int
    currency: Currency = Currency.TRY
    quote_no: Optional[str] = None
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None

class QuoteCreate(QuoteBase):
    items: List[QuoteItemCreate]

class QuoteFromDeal(BaseModel):
    """Fırsattan teklif oluşturma"""
    currency: Currency = Currency.TRY
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    items: List[QuoteItemCreate]

class Quote(QuoteBase):
    id: int
    version: int
    status: QuoteStatus
    subtotal: float
    discount_amount: float
    vat_amount: float
    total_amount: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[QuoteItem] = []
    account: Optional[Account] = None

    class Config:
        from_attributes = True

# Invoice Item
class InvoiceItemBase(BaseModel):
    product_id: Optional[int] = None
    description: str
    quantity: float
    unit_price: float
    vat_rate: int

class InvoiceItemCreate(InvoiceItemBase):
    pass

class InvoiceItem(InvoiceItemBase):
    id: int
    line_total: float
    vat_amount: float
    total_with_vat: float

    class Config:
        from_attributes = True

# Invoice
class InvoiceBase(BaseModel):
    invoice_type: InvoiceType = InvoiceType.SALES
    invoice_no: Optional[str] = None
    account_id: int
    currency: Currency = Currency.TRY
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None

class InvoiceCreate(InvoiceBase):
    items: List[InvoiceItemCreate]

class Invoice(InvoiceBase):
    id: int
    subtotal: float
    vat_amount: float
    total_amount: float
    status: str
    items: List[InvoiceItem] = []

    class Config:
        from_attributes = True

# Transaction
class TransactionBase(BaseModel):
    account_id: int
    invoice_id: Optional[int] = None
    transaction_type: TransactionType
    debit: float = 0.0
    credit: float = 0.0
    date: Optional[datetime] = None
    description: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class Transaction(TransactionBase):
    id: int

    class Config:
        from_attributes = True

# Dashboard KPIs
class DashboardKPIs(BaseModel):
    total_receivables: float
    total_payables: float
    monthly_sales: float
    monthly_expenses: float
    net_balance: float
    lead_conversion_rate: float

# Pipeline Stats
class PipelineStats(BaseModel):
    total_deals: int
    total_value: float
    by_stage: dict
