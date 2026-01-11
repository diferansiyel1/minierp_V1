from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, date
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
    TRANSFER = "Transfer"

class ProjectStatus(str, Enum):
    ACTIVE = "Active"
    COMPLETED = "Completed"
    ON_HOLD = "On Hold"

class ProductType(str, Enum):
    GOODS = "Goods"
    SERVICE = "Service"

class FinancialAccountType(str, Enum):
    CASH = "Cash"
    BANK = "Bank"

class PaymentStatus(str, Enum):
    UNPAID = "Unpaid"
    PARTIAL = "Partial"
    PAID = "Paid"

class IncomeType(str, Enum):
    TECHNOPARK_INCOME = "Technopark Income"
    OTHER_INCOME = "Other Income"

class DiscountType(str, Enum):
    NONE = "None"
    TECHNOPARK_RENT = "Teknokent Kira Desteği"
    COMMERCIAL = "Ticari İskonto"
    PROJECT_SUPPORT = "Proje Desteği"

class ExpenseCategory(str, Enum):
    RENT = "Kira"
    HARDWARE = "Donanım"
    SOFTWARE = "Yazılım"
    CONSULTANCY = "Danışmanlık"
    PERSONNEL = "Personel"
    OTHER = "Diğer"

class ActivityType(str, Enum):
    CALL = "Call"
    MEETING = "Meeting"
    EMAIL = "Email"
    NOTE = "Note"

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
    product_type: ProductType = ProductType.SERVICE
    is_software_product: bool = False
    default_vat_rate: int = 20
    vat_exemption_reason_code: Optional[str] = None

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
    project_id: Optional[int] = None
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

class QuoteBase(BaseModel):
    deal_id: Optional[int] = None
    account_id: int
    project_id: Optional[int] = None
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

class QuoteUpdate(BaseModel):
    """Teklif güncelleme"""
    account_id: Optional[int] = None
    currency: Optional[Currency] = None
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
    withholding_rate: float = 0.0
    is_exempt: bool = False
    exemption_code: Optional[str] = None
    original_vat_rate: Optional[int] = None

class InvoiceItemCreate(InvoiceItemBase):
    pass

class InvoiceItem(InvoiceItemBase):
    id: int
    line_total: float
    vat_amount: float
    withholding_amount: float = 0.0
    total_with_vat: float
    is_exempt: bool = False
    exemption_code: Optional[str] = None
    original_vat_rate: Optional[int] = None

    class Config:
        from_attributes = True

# Invoice
class InvoiceBase(BaseModel):
    invoice_type: InvoiceType = InvoiceType.SALES
    invoice_no: Optional[str] = None
    account_id: int
    project_id: Optional[int] = None
    currency: Currency = Currency.TRY
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    discount_type: Optional[DiscountType] = None
    discount_amount: float = 0.0
    expense_category: Optional[ExpenseCategory] = None
    is_project_expense: bool = False
    notes: Optional[str] = None

class InvoiceCreate(InvoiceBase):
    items: List[InvoiceItemCreate]

class Invoice(InvoiceBase):
    id: int
    subtotal: float
    vat_amount: float
    withholding_amount: float = 0.0
    total_amount: float
    status: str
    payment_status: PaymentStatus = PaymentStatus.UNPAID
    paid_amount: float = 0.0
    exempt_amount: float = 0.0
    taxable_amount: float = 0.0
    discount_type: Optional[DiscountType] = None
    discount_amount: float = 0.0
    expense_category: Optional[ExpenseCategory] = None
    is_project_expense: bool = False
    notes: Optional[str] = None
    items: List[InvoiceItem] = []

    class Config:
        from_attributes = True

# Transaction
class TransactionBase(BaseModel):
    account_id: Optional[int] = None
    invoice_id: Optional[int] = None
    project_id: Optional[int] = None
    source_financial_account_id: Optional[int] = None
    destination_financial_account_id: Optional[int] = None
    transaction_type: TransactionType
    debit: float = 0.0
    credit: float = 0.0
    date: Optional[datetime] = None
    description: Optional[str] = None
    support_ref_no: Optional[str] = None

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
    total_cash_balance: float = 0.0

# Pipeline Stats
class PipelineStats(BaseModel):
    total_deals: int
    total_value: float
    by_stage: dict

# ==================== NEW SCHEMAS ====================

# Project
class ProjectBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: ProjectStatus = ProjectStatus.ACTIVE
    budget: float = 0.0
    is_technopark_project: bool = False
    exemption_code: str = "4691"
    spent_budget: float = 0.0

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[ProjectStatus] = None
    budget: Optional[float] = None

class Project(ProjectBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ProjectSummary(BaseModel):
    """Proje Finansal Özeti"""
    project: Project
    total_income: float = 0.0
    total_expense: float = 0.0
    profit: float = 0.0
    invoice_count: int = 0

# Financial Account
class FinancialAccountBase(BaseModel):
    name: str
    account_type: FinancialAccountType = FinancialAccountType.CASH
    currency: Currency = Currency.TRY
    description: Optional[str] = None

class FinancialAccountCreate(FinancialAccountBase):
    initial_balance: float = 0.0

class FinancialAccountUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class FinancialAccount(FinancialAccountBase):
    id: int
    balance: float
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class TransferRequest(BaseModel):
    """Hesaplar arası virman"""
    source_account_id: int
    destination_account_id: int
    amount: float
    description: Optional[str] = None

# Contact
class ContactBase(BaseModel):
    account_id: int
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    is_primary: bool = False

class ContactCreate(ContactBase):
    pass

class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    is_primary: Optional[bool] = None

class Contact(ContactBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Activity
class ActivityBase(BaseModel):
    activity_type: ActivityType = ActivityType.NOTE
    summary: str
    date: Optional[datetime] = None
    deal_id: Optional[int] = None
    account_id: Optional[int] = None
    contact_id: Optional[int] = None

class ActivityCreate(ActivityBase):
    pass

class Activity(ActivityBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# User & Authentication
class UserBase(BaseModel):
    email: str
    full_name: str

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None

class User(UserBase):
    id: int
    is_active: bool
    is_superuser: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    email: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str


class PaymentRequest(BaseModel):
    """Fatura ödeme/tahsilat talebi"""
    amount: float  # Ödenen tutar (kısmi olabilir)
    financial_account_id: int  # Kasa/Banka ID
    date: Optional[datetime] = None  # İşlem tarihi
    description: Optional[str] = None  # Açıklama


# ==================== INVOICE PARSER SCHEMAS ====================

class ParsedInvoiceLine(BaseModel):
    """Parsed invoice line item from PDF"""
    description: str
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    vat_rate: Optional[int] = None
    discount_rate: Optional[int] = None
    discount_amount: Optional[float] = None
    total: Optional[float] = None


class AccountInfo(BaseModel):
    """Unified account info from invoice"""
    name: Optional[str] = None
    tax_id: Optional[str] = None
    address: Optional[str] = None
    tax_office: Optional[str] = None


class ParsedInvoice(BaseModel):
    """PDF parsing result"""
    # Invoice ID
    ettn: Optional[str] = None
    invoice_no: Optional[str] = None
    issue_date: Optional[date] = None
    
    # Issuer (Faturayı Kesen)
    issuer_name: Optional[str] = None
    issuer_tax_id: Optional[str] = None
    issuer_address: Optional[str] = None
    issuer_tax_office: Optional[str] = None
    
    # Customer (Alıcı)
    customer_name: Optional[str] = None
    customer_tax_id: Optional[str] = None
    customer_address: Optional[str] = None
    customer_tax_office: Optional[str] = None
    
    # Legacy fields (for compatibility)
    supplier_name: Optional[str] = None
    receiver_name: Optional[str] = None
    tax_id: Optional[str] = None
    tax_office: Optional[str] = None
    address: Optional[str] = None
    
    # Unified account info (based on invoice_type)
    account_info: Optional[AccountInfo] = None
    
    # Totals
    gross_total: Optional[float] = None
    total_discount: Optional[float] = None
    net_subtotal: Optional[float] = None
    tax_amount: Optional[float] = None
    total_amount: Optional[float] = None
    
    # Verification
    verification_status: Optional[str] = None
    verification_notes: List[str] = []
    
    # Classification
    invoice_type: InvoiceType = InvoiceType.PURCHASE
    suggested_project_code: Optional[str] = None
    is_technopark_expense: bool = False
    expense_type: Optional[ExpenseCategory] = None
    vat_exempt: bool = False
    
    # Data
    lines: List[ParsedInvoiceLine] = []
    notes: List[str] = []
    raw_text: Optional[str] = None

