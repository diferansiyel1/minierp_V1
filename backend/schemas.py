from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, date
from enum import Enum

# Enums
class UserRole(str, Enum):
    SUPERADMIN = "superadmin"
    ADMIN = "admin"
    USER = "user"

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
    TRAVEL = "Seyahat"
    COMMUNICATION = "İletişim"
    UTILITIES = "Elektrik/Su/Doğalgaz"
    OTHER = "Diğer"

class ExpenseCenter(str, Enum):
    """Gider Merkezi - Teknokent muafiyet raporu için kritik"""
    RD_CENTER = "Ar-Ge Merkezi"
    MARKETING = "Pazarlama"
    GENERAL_ADMIN = "Genel Yönetim"
    PRODUCTION = "Üretim"

class ActivityType(str, Enum):
    CALL = "Call"
    MEETING = "Meeting"
    EMAIL = "Email"
    NOTE = "Note"


class EducationLevel(str, Enum):
    """Eğitim Seviyesi - Gelir Vergisi İstisnası Hesaplaması İçin"""
    PHD = "Doktora"
    MASTER = "Yüksek Lisans"
    BACHELOR = "Lisans"
    OTHER = "Diğer"

# Tenant
class TenantBase(BaseModel):
    name: str
    slug: str
    is_active: bool = True
    settings: Optional[str] = None

class TenantCreate(TenantBase):
    pass

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    settings: Optional[str] = None

class Tenant(TenantBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Account
class AccountBase(BaseModel):
    account_type: AccountType = AccountType.CUSTOMER
    entity_type: CustomerType = CustomerType.CORPORATE
    title: str
    tax_id: Optional[str] = None
    tax_office: Optional[str] = None
    address: Optional[str] = None
    billing_address: Optional[str] = None  # Fatura Adresi
    # vTiger shipping address
    ship_street: Optional[str] = None
    ship_city: Optional[str] = None
    ship_state: Optional[str] = None
    ship_code: Optional[str] = None
    ship_country: Optional[str] = None
    # Ek vTiger alanları
    website: Optional[str] = None
    industry: Optional[str] = None
    employees: Optional[int] = None
    annual_revenue: Optional[float] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class AccountCreate(AccountBase):
    vtiger_id: Optional[str] = None  # CSV import için

class Account(AccountBase):
    id: int
    vtiger_id: Optional[str] = None
    receivable_balance: float = 0.0
    payable_balance: float = 0.0
    contacts: List['Contact'] = []  # İlgili kişiler
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None

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

class DealUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[DealStatus] = None
    estimated_value: Optional[float] = None
    source: Optional[str] = None

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
    unit: str = "Adet"  # Birim: Adet, Ay, Kutu, Hafta, Gün, Saat, Paket, Koli
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
    unit: str = "Adet"
    product: Optional[Product] = None
    
    class Config:
        from_attributes = True

class QuoteBase(BaseModel):
    deal_id: Optional[int] = None
    account_id: int
    contact_id: int  # Required for contact-centric tracking
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
    parent_quote_id: Optional[int] = None
    revision_number: int = 0
    subtotal: float
    discount_amount: float
    vat_amount: float
    total_amount: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[QuoteItem] = []
    account: Optional[Account] = None
    revisions: List['Quote'] = []

    class Config:
        from_attributes = True

# Invoice Item
class InvoiceItemBase(BaseModel):
    product_id: Optional[int] = None
    description: str
    quantity: float
    unit: str = "Adet"  # Birim: Adet, Ay, Kutu, Hafta, Gün, Saat, Paket, Koli
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
    unit: str = "Adet"
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
    expense_center: Optional['ExpenseCenter'] = None

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
    expense_center: Optional[ExpenseCenter] = None
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
    mobile: Optional[str] = None  # vTiger
    role: Optional[str] = None  # vTiger: title
    department: Optional[str] = None  # vTiger
    salutation: Optional[str] = None  # vTiger: Mr., Ms., Dr.
    is_primary: bool = False
    # vTiger mailing address
    mailing_street: Optional[str] = None
    mailing_city: Optional[str] = None
    mailing_state: Optional[str] = None
    mailing_zip: Optional[str] = None
    mailing_country: Optional[str] = None
    # Ek vTiger alanları
    do_not_call: bool = False
    email_opt_out: bool = False
    description: Optional[str] = None

class ContactCreate(ContactBase):
    vtiger_id: Optional[str] = None  # CSV import için

class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    salutation: Optional[str] = None
    is_primary: Optional[bool] = None
    mailing_street: Optional[str] = None
    mailing_city: Optional[str] = None
    mailing_state: Optional[str] = None
    mailing_zip: Optional[str] = None
    mailing_country: Optional[str] = None
    do_not_call: Optional[bool] = None
    email_opt_out: Optional[bool] = None
    description: Optional[str] = None

class Contact(ContactBase):
    id: int
    vtiger_id: Optional[str] = None
    created_at: datetime
    modified_at: Optional[datetime] = None

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
    role: UserRole = UserRole.USER

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

class UserWithTenant(User):
    tenant_id: Optional[int] = None
    tenant: Optional[Tenant] = None

class UserInfo(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    tenant_id: Optional[int] = None
    is_active: bool

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[UserInfo] = None

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



class CompanySettings(BaseModel):
    """Firma Bilgileri - Tenant Settings içinde JSON olarak saklanır"""
    company_name: Optional[str] = None
    tax_id: Optional[str] = None
    tax_office: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None
    
    # Fatura Ayarları
    invoice_prefix: str = "FAT"
    invoice_next_number: int = 1
    
    # Teklif Ayarları
    quote_prefix: str = "TF"
    quote_year: str = "24"
    quote_sequence: int = 1


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


class SystemSettingBase(BaseModel):
    key: str
    value: str
    description: Optional[str] = None

class SystemSettingCreate(SystemSettingBase):
    pass

class SystemSettingUpdate(BaseModel):
    value: str
    description: Optional[str] = None

class SystemSetting(SystemSettingBase):
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ==================== EXEMPTION REPORT SCHEMAS ====================

class ExemptionReportBase(BaseModel):
    project_id: int
    year: int
    month: int
    notes: Optional[str] = None
    total_personnel_cost: float = 0.0
    total_rd_expense: float = 0.0
    total_exempt_income: float = 0.0
    total_taxable_income: float = 0.0
    
    corporate_tax_exemption_amount: float = 0.0
    vat_exemption_amount: float = 0.0
    personnel_income_tax_exemption_amount: float = 0.0
    personnel_sgk_exemption_amount: float = 0.0
    personnel_stamp_tax_exemption_amount: float = 0.0
    total_tax_advantage: float = 0.0
    
    # 5746/4691 Sayılı Kanun - Girişim Sermayesi Yükümlülüğü
    venture_capital_obligation: float = 0.0
    is_venture_capital_invested: bool = False
    remote_work_ratio_applied: float = 1.0
    calculated_tax_advantage: float = 0.0
    exemption_base: float = 0.0


class ExemptionReportCreate(ExemptionReportBase):
    pass


class ExemptionReport(ExemptionReportBase):
    id: int
    tenant_id: Optional[int] = None
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== TAX PARAMETERS SCHEMAS ====================

class IncomeTaxExemptions(BaseModel):
    """Gelir Vergisi İstisna Oranları"""
    phd_basic_sciences: float = 0.95  # Doktora + Temel Bilimler
    masters_basic_sciences: float = 0.90  # Y. Lisans + Temel Bilimler
    phd_other: float = 0.90  # Doktora + Diğer
    masters_other: float = 0.80  # Y. Lisans + Diğer
    bachelors: float = 0.80  # Lisans


class TaxParameters2026(BaseModel):
    """2026 Yılı Teknokent Vergi Parametreleri (5746/4691 Sayılı Kanun)"""
    year: int = 2026
    venture_capital_limit: float = 5000000.0  # 5M TL
    venture_capital_rate: float = 0.03  # %3
    venture_capital_max_amount: float = 100000000.0  # 100M TL üst sınır
    remote_work_rate_informatics: float = 1.0  # Bilişim personeli %100
    remote_work_rate_other: float = 0.75  # Diğer personel %75
    income_tax_exemptions: IncomeTaxExemptions = IncomeTaxExemptions()
    corporate_tax_rate: float = 0.25  # Kurumlar Vergisi %25
    vat_rate: float = 0.20  # KDV %20
    daily_food_exemption: float = 300.0  # Günlük yemek muafiyeti
    daily_transport_exemption: float = 158.0  # Günlük ulaşım muafiyeti
    sgk_employer_share_discount: float = 0.50  # SGK işveren hissesi indirimi %50
    stamp_tax_exemption_rate: float = 1.0  # Damga vergisi muafiyeti %100


class TaxParametersUpdate(BaseModel):
    """Vergi Parametreleri Güncelleme"""
    venture_capital_limit: Optional[float] = None
    venture_capital_rate: Optional[float] = None
    venture_capital_max_amount: Optional[float] = None
    remote_work_rate_informatics: Optional[float] = None
    remote_work_rate_other: Optional[float] = None
    income_tax_exemptions: Optional[IncomeTaxExemptions] = None
    corporate_tax_rate: Optional[float] = None
    vat_rate: Optional[float] = None
    daily_food_exemption: Optional[float] = None
    daily_transport_exemption: Optional[float] = None
    sgk_employer_share_discount: Optional[float] = None
    stamp_tax_exemption_rate: Optional[float] = None


# ==================== TAX CALCULATION RESULT SCHEMAS ====================

class CorporateTaxExemptionResult(BaseModel):
    """Kurumlar Vergisi İstisnası Hesaplama Sonucu"""
    total_exempt_income: float
    total_rd_expense: float
    exemption_base: float  # Muaf Gelir - Ar-Ge Gideri
    corporate_tax_exemption: float  # exemption_base * %25
    vat_exemption: float  # exempt_income * %20
    venture_capital_obligation: float
    is_venture_capital_required: bool


class PersonnelIncentiveResult(BaseModel):
    """Personel Teşvik Hesaplama Sonucu"""
    user_id: int
    full_name: str
    education_level: str
    is_basic_science_grad: bool
    is_informatics_personnel: bool
    days_worked: int
    remote_days: int
    remote_work_ratio: float
    income_tax_exemption_rate: float
    calculated_income_tax_exemption: float
    sgk_employer_discount: float
    stamp_tax_exemption: float
    total_incentive: float


class MonthlyTaxCalculationResult(BaseModel):
    """Aylık Vergi Hesaplama Sonucu"""
    year: int
    month: int
    corporate_tax: CorporateTaxExemptionResult
    personnel_incentives: List[PersonnelIncentiveResult]
    total_personnel_incentive: float
    total_tax_advantage: float
    venture_capital_warning: Optional[str] = None


class YearlyTaxSummary(BaseModel):
    """Yıllık Vergi Özeti"""
    year: int
    total_exempt_income: float
    total_rd_expense: float
    total_corporate_tax_exemption: float
    total_vat_exemption: float
    total_personnel_incentive: float
    total_venture_capital_obligation: float
    total_tax_advantage: float

