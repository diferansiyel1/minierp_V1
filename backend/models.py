from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, Text, Boolean, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import enum

class CustomerType(str, enum.Enum):
    INDIVIDUAL = "Individual"
    CORPORATE = "Corporate"

class AccountType(str, enum.Enum):
    CUSTOMER = "Customer"
    SUPPLIER = "Supplier"
    BOTH = "Both"

class InvoiceType(str, enum.Enum):
    SALES = "Sales"
    PURCHASE = "Purchase"

class Currency(str, enum.Enum):
    TRY = "TRY"
    EUR = "EUR"
    USD = "USD"
    GBP = "GBP"

class DealStatus(str, enum.Enum):
    LEAD = "Lead"
    OPPORTUNITY = "Opportunity"
    QUOTE_SENT = "Quote Sent"
    NEGOTIATION = "Negotiation"
    ORDER_RECEIVED = "Order Received"
    INVOICED = "Invoiced"
    LOST = "Lost"

class QuoteStatus(str, enum.Enum):
    DRAFT = "Draft"
    SENT = "Sent"
    ACCEPTED = "Accepted"
    REJECTED = "Rejected"
    EXPIRED = "Expired"

class TransactionType(str, enum.Enum):
    SALES_INVOICE = "Sales Invoice"
    PURCHASE_INVOICE = "Purchase Invoice"
    COLLECTION = "Collection"
    PAYMENT = "Payment"
    TRANSFER = "Transfer"

class ProjectStatus(str, enum.Enum):
    ACTIVE = "Active"
    COMPLETED = "Completed"
    ON_HOLD = "On Hold"

class ProductType(str, enum.Enum):
    GOODS = "Goods"
    SERVICE = "Service"

class FinancialAccountType(str, enum.Enum):
    CASH = "Cash"
    BANK = "Bank"

class PaymentStatus(str, enum.Enum):
    UNPAID = "Unpaid"
    PARTIAL = "Partial"
    PAID = "Paid"

class IncomeType(str, enum.Enum):
    """Gelir Türü - Kurumlar Vergisi raporlaması için"""
    TECHNOPARK_INCOME = "Technopark Income"  # Bölge İçi Gelir (Muaf)
    OTHER_INCOME = "Other Income"  # Bölge Dışı Gelir

class DiscountType(str, enum.Enum):
    """Fatura İndirim Türü"""
    NONE = "None"
    TECHNOPARK_RENT = "Teknokent Kira Desteği"  # Kuluçka %50
    COMMERCIAL = "Ticari İskonto"
    PROJECT_SUPPORT = "Proje Desteği"

class ExpenseCategory(str, enum.Enum):
    """Gider Kategorisi"""
    RENT = "Kira"
    HARDWARE = "Donanım"
    SOFTWARE = "Yazılım"
    CONSULTANCY = "Danışmanlık"
    PERSONNEL = "Personel"
    TRAVEL = "Seyahat"
    COMMUNICATION = "İletişim"
    UTILITIES = "Elektrik/Su/Doğalgaz"
    OTHER = "Diğer"

class ExpenseCenter(str, enum.Enum):
    """Gider Merkezi - Teknokent muafiyet raporu için kritik"""
    RD_CENTER = "Ar-Ge Merkezi"
    MARKETING = "Pazarlama"
    GENERAL_ADMIN = "Genel Yönetim"
    PRODUCTION = "Üretim"

class ActivityType(str, enum.Enum):
    CALL = "Call"
    MEETING = "Meeting"
    EMAIL = "Email"
    NOTE = "Note"

class UserRole(str, enum.Enum):
    """User roles for multi-tenant access control"""
    SUPERADMIN = "superadmin"  # Can access all tenants
    ADMIN = "admin"  # Tenant administrator
    USER = "user"  # Regular tenant user


class EducationLevel(str, enum.Enum):
    """Eğitim Seviyesi - Gelir Vergisi İstisnası Hesaplaması İçin"""
    PHD = "Doktora"
    MASTER = "Yüksek Lisans"
    BACHELOR = "Lisans"
    OTHER = "Diğer"


class PersonnelType(str, enum.Enum):
    RD_PERSONNEL = "RD_PERSONNEL"
    SUPPORT_PERSONNEL = "SUPPORT_PERSONNEL"
    INTERN = "INTERN"


class PayrollEducationLevel(str, enum.Enum):
    HIGH_SCHOOL = "HIGH_SCHOOL"
    ASSOCIATE = "ASSOCIATE"
    BACHELOR = "BACHELOR"
    MASTER = "MASTER"
    PHD = "PHD"


class GraduationField(str, enum.Enum):
    ENGINEERING = "ENGINEERING"
    BASIC_SCIENCES = "BASIC_SCIENCES"
    OTHER = "OTHER"


class Tenant(Base):
    """Multi-tenant SaaS tenant model"""
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    slug = Column(String, unique=True, index=True)
    is_active = Column(Boolean, default=True)
    settings = Column(Text, nullable=True)  # JSON settings
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    users = relationship("User", back_populates="tenant")
    accounts = relationship("Account", back_populates="tenant")
    products = relationship("Product", back_populates="tenant")
    projects = relationship("Project", back_populates="tenant")
    financial_accounts = relationship("FinancialAccount", back_populates="tenant")
    quotes = relationship("Quote", back_populates="tenant")
    deals = relationship("Deal", back_populates="tenant")
    orders = relationship("Order", back_populates="tenant")
    invoices = relationship("Invoice", back_populates="tenant")
    transactions = relationship("Transaction", back_populates="tenant")
    contacts = relationship("Contact", back_populates="tenant")
    activities = relationship("Activity", back_populates="tenant")
    employees = relationship("Employee", back_populates="tenant")
    payroll_periods = relationship("PayrollPeriod", back_populates="tenant")
    payroll_entries = relationship("PayrollEntry", back_populates="tenant")

class Account(Base):
    """Unified account for both Customers (Müşteri) and Suppliers (Tedarikçi) - vTiger CRM 7.5 uyumlu"""
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    # vTiger uyumluluk: vtiger_accountid
    vtiger_id = Column(String, nullable=True, index=True)
    account_type = Column(String, default=AccountType.CUSTOMER)
    entity_type = Column(String, default=CustomerType.CORPORATE)
    title = Column(String, index=True)  # vTiger: accountname
    tax_id = Column(String)
    tax_office = Column(String)
    address = Column(String)  # vTiger: bill_street
    billing_address = Column(String, nullable=True)  # Fatura Adresi (combined)
    # vTiger shipping address fields
    ship_street = Column(String, nullable=True)
    ship_city = Column(String, nullable=True)
    ship_state = Column(String, nullable=True)
    ship_code = Column(String, nullable=True)
    ship_country = Column(String, nullable=True)
    # Ek vTiger alanları
    website = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    employees = Column(Integer, nullable=True)
    annual_revenue = Column(Float, nullable=True)
    description = Column(Text, nullable=True)
    phone = Column(String)
    email = Column(String)
    receivable_balance = Column(Float, default=0.0)
    payable_balance = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    modified_at = Column(DateTime(timezone=True), onupdate=func.now())

    deals = relationship("Deal", back_populates="account")
    invoices = relationship("Invoice", back_populates="account")
    transactions = relationship("Transaction", back_populates="account")
    contacts = relationship("Contact", back_populates="account")
    tenant = relationship("Tenant", back_populates="accounts")

# Keep Customer as alias for backward compatibility
Customer = Account

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    name = Column(String, index=True)
    code = Column(String, unique=True, index=True)
    unit_price = Column(Float)
    vat_rate = Column(Integer)
    unit = Column(String)
    product_type = Column(String, default=ProductType.SERVICE)
    # Stok Takibi
    stock_quantity = Column(Float, default=0.0)
    # Teknokent KDV Muafiyeti için
    is_software_product = Column(Boolean, default=False)
    default_vat_rate = Column(Integer, default=20)  # Varsayılan KDV oranı
    vat_exemption_reason_code = Column(String, nullable=True)  # e.g., "351"
    
    tenant = relationship("Tenant", back_populates="products")

class Deal(Base):
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    title = Column(String)
    source = Column(String)
    status = Column(String, default=DealStatus.LEAD)
    probability = Column(Float, default=0.0)
    estimated_value = Column(Float, default=0.0)
    account_id = Column(Integer, ForeignKey("accounts.id"))
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    account = relationship("Account", back_populates="deals")
    project = relationship("Project", back_populates="deals")
    quotes = relationship("Quote", back_populates="deal")
    orders = relationship("Order", back_populates="deal")
    activities = relationship("Activity", back_populates="deal")
    tenant = relationship("Tenant", back_populates="deals")

class Quote(Base):
    """Teklif - Fırsata bağlı fiyat teklifi"""
    __tablename__ = "quotes"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    quote_no = Column(String, index=True)
    parent_quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=True)
    revision_number = Column(Integer, default=0)  # 0 = ana teklif, 1+ = revizyon
    deal_id = Column(Integer, ForeignKey("deals.id"))
    account_id = Column(Integer, ForeignKey("accounts.id"))
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)  # İlgili Kişi
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    currency = Column(String, default=Currency.TRY)
    version = Column(Integer, default=1)
    status = Column(String, default=QuoteStatus.DRAFT)
    subtotal = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    vat_amount = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    valid_until = Column(DateTime(timezone=True))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    deal = relationship("Deal", back_populates="quotes")
    account = relationship("Account")
    contact = relationship("Contact")  # İlgili kişi ilişkisi
    project = relationship("Project", back_populates="quotes")
    items = relationship("QuoteItem", back_populates="quote", cascade="all, delete-orphan")
    parent_quote = relationship("Quote", remote_side=[id], backref="revisions")
    tenant = relationship("Tenant", back_populates="quotes")

class QuoteItem(Base):
    """Teklif Kalemi"""
    __tablename__ = "quote_items"

    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey("quotes.id"))
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    description = Column(String)
    quantity = Column(Float)
    unit = Column(String, default="Adet")  # Birim: Adet, Ay, Kutu, Hafta, vb.
    unit_price = Column(Float)
    discount_percent = Column(Float, default=0.0)
    vat_rate = Column(Integer)
    line_total = Column(Float)
    vat_amount = Column(Float)
    total_with_vat = Column(Float)

    quote = relationship("Quote", back_populates="items")
    product = relationship("Product")

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    deal_id = Column(Integer, ForeignKey("deals.id"))
    quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=True)
    status = Column(String)
    total_amount = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    deal = relationship("Deal", back_populates="orders")
    invoice = relationship("Invoice", uselist=False, back_populates="order")
    tenant = relationship("Tenant", back_populates="orders")

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    invoice_type = Column(String, default=InvoiceType.SALES)
    invoice_no = Column(String, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"))
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    currency = Column(String, default=Currency.TRY)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    issue_date = Column(DateTime(timezone=True), server_default=func.now())
    due_date = Column(DateTime(timezone=True))
    subtotal = Column(Float, default=0.0)
    vat_amount = Column(Float, default=0.0)
    withholding_amount = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    status = Column(String, default="Draft")
    payment_status = Column(String, default=PaymentStatus.UNPAID)
    paid_amount = Column(Float, default=0.0)
    # Satır Bazlı İstisna Toplam Alanları
    exempt_amount = Column(Float, default=0.0)    # KDV'siz matrah
    taxable_amount = Column(Float, default=0.0)   # KDV'li matrah
    # Gider Faturası Özellikleri
    discount_type = Column(String, nullable=True)  # DiscountType enum
    discount_amount = Column(Float, default=0.0)   # İndirim tutarı
    expense_category = Column(String, nullable=True)  # ExpenseCategory enum
    is_project_expense = Column(Boolean, default=False)  # Proje gideri mi?
    notes = Column(Text, nullable=True)  # Notlar
    expense_center = Column(String, nullable=True)  # ExpenseCenter enum - Gider merkezi

    account = relationship("Account", back_populates="invoices")
    order = relationship("Order", back_populates="invoice")
    project = relationship("Project", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice")
    transactions = relationship("Transaction", back_populates="invoice")
    tenant = relationship("Tenant", back_populates="invoices")

class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"))
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    description = Column(String)
    quantity = Column(Float)
    unit = Column(String, default="Adet")  # Birim: Adet, Ay, Kutu, Hafta, vb.
    unit_price = Column(Float)
    vat_rate = Column(Integer)
    withholding_rate = Column(Float, default=0.0)
    line_total = Column(Float)
    vat_amount = Column(Float)
    withholding_amount = Column(Float, default=0.0)
    total_with_vat = Column(Float)
    # Satır Bazlı İstisna Alanları
    is_exempt = Column(Boolean, default=False)
    exemption_code = Column(String, nullable=True)  # "3065 G.20/1"
    original_vat_rate = Column(Integer, nullable=True)  # Bilgi amaçlı orijinal oran
    vat_exemption_reason = Column(String, nullable=True)  # Eski alan - uyumluluk için

    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product")

class Transaction(Base):
    """
    Finansal Hareket - Çift taraflı muhasebe mantığı
    - Sales Invoice: Müşteri Borç (+receivable)
    - Purchase Invoice: Tedarikçi Alacak (+payable)
    - Collection: Müşteri Alacak (-receivable), Kasa/Banka (+)
    - Payment: Tedarikçi Borç (-payable), Kasa/Banka (-)
    - Transfer: Kasa/Banka arası virman
    """
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    source_financial_account_id = Column(Integer, ForeignKey("financial_accounts.id"), nullable=True)
    destination_financial_account_id = Column(Integer, ForeignKey("financial_accounts.id"), nullable=True)
    transaction_type = Column(String)
    debit = Column(Float, default=0.0)
    credit = Column(Float, default=0.0)
    date = Column(DateTime(timezone=True), server_default=func.now())
    description = Column(String)
    # Kuluçka Destek Referansı (kira indirimi vb.)
    support_ref_no = Column(String, nullable=True)

    account = relationship("Account", back_populates="transactions")
    invoice = relationship("Invoice", back_populates="transactions")
    project = relationship("Project", back_populates="transactions")
    source_financial_account = relationship("FinancialAccount", foreign_keys=[source_financial_account_id])
    destination_financial_account = relationship("FinancialAccount", foreign_keys=[destination_financial_account_id])
    tenant = relationship("Tenant", back_populates="transactions")

    @property
    def amount(self):
        return self.debit - self.credit


# ==================== NEW MODELS ====================

class Project(Base):
    """Ar-Ge Proje Yönetimi"""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    name = Column(String, index=True)
    code = Column(String, unique=True, index=True)
    description = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(String, default=ProjectStatus.ACTIVE)
    budget = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Teknokent Muafiyet Alanları
    is_technopark_project = Column(Boolean, default=False)
    exemption_code = Column(String, default="4691")  # 4691 veya 5746
    # Bütçe Takibi
    spent_budget = Column(Float, default=0.0)  # Harcanan bütçe

    deals = relationship("Deal", back_populates="project")
    quotes = relationship("Quote", back_populates="project")
    invoices = relationship("Invoice", back_populates="project")
    transactions = relationship("Transaction", back_populates="project")
    tenant = relationship("Tenant", back_populates="projects")


class FinancialAccount(Base):
    """Kasa ve Banka Hesapları"""
    __tablename__ = "financial_accounts"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    name = Column(String, index=True)
    account_type = Column(String, default=FinancialAccountType.CASH)
    currency = Column(String, default=Currency.TRY)
    balance = Column(Float, default=0.0)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    tenant = relationship("Tenant", back_populates="financial_accounts")


class Contact(Base):
    """Firma Çalışanları / İletişim Kişileri - vTiger CRM 7.5 uyumlu"""
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    # vTiger uyumluluk: vtiger_contactid
    vtiger_id = Column(String, nullable=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"))
    first_name = Column(String)
    last_name = Column(String)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    mobile = Column(String, nullable=True)  # vTiger: mobile
    role = Column(String, nullable=True)  # vTiger: title
    department = Column(String, nullable=True)  # vTiger: department
    salutation = Column(String, nullable=True)  # vTiger: salutation (Mr., Ms., Dr.)
    is_primary = Column(Boolean, default=False)
    # Adres bilgileri (vTiger mailing address)
    mailing_street = Column(String, nullable=True)
    mailing_city = Column(String, nullable=True)
    mailing_state = Column(String, nullable=True)
    mailing_zip = Column(String, nullable=True)
    mailing_country = Column(String, nullable=True)
    # Ek vTiger alanları
    do_not_call = Column(Boolean, default=False)
    email_opt_out = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    modified_at = Column(DateTime(timezone=True), onupdate=func.now())

    account = relationship("Account")
    tenant = relationship("Tenant", back_populates="contacts")


class Activity(Base):
    """CRM Aktiviteleri - Görüşme, Toplantı, Not"""
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    activity_type = Column(String, default=ActivityType.NOTE)
    summary = Column(Text)
    date = Column(DateTime(timezone=True), server_default=func.now())
    deal_id = Column(Integer, ForeignKey("deals.id"), nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    deal = relationship("Deal", back_populates="activities")
    account = relationship("Account")
    contact = relationship("Contact")
    tenant = relationship("Tenant", back_populates="activities")


class User(Base):
    """Sistem Kullanıcıları"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)  # Null for superadmin
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    role = Column(String, default=UserRole.USER)  # superadmin/admin/user
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)  # Deprecated, use role instead
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Teknokent Personel Muafiyet Alanları (5746/4691 Sayılı Kanun)
    education_level = Column(String, default=EducationLevel.BACHELOR)  # Eğitim seviyesi
    is_basic_science_grad = Column(Boolean, default=False)  # Temel bilimler mezunu mu?
    is_informatics_personnel = Column(Boolean, default=False)  # Bilişim personeli mi? (Uzaktan çalışma %100 vs %75)
    daily_gross_salary = Column(Float, nullable=True)  # Günlük brüt maaş
    
    tenant = relationship("Tenant", back_populates="users")


class Employee(Base):
    """Teknokent Personel & Bordro Yönetimi"""
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)

    full_name = Column(String, index=True)
    tc_id_no = Column(String, index=True)
    email = Column(String, nullable=True)

    is_active = Column(Boolean, default=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    personnel_type = Column(Enum(PersonnelType), nullable=False)
    education_level = Column(Enum(PayrollEducationLevel), nullable=False)
    graduation_field = Column(Enum(GraduationField), nullable=False)
    is_student = Column(Boolean, default=False)

    gross_salary = Column(Float, default=0.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="employees")
    payroll_entries = relationship("PayrollEntry", back_populates="employee")


class PayrollPeriod(Base):
    """Aylık bordro dönemi"""
    __tablename__ = "payroll_periods"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)

    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    is_locked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tenant = relationship("Tenant", back_populates="payroll_periods")
    entries = relationship("PayrollEntry", back_populates="payroll_period", cascade="all, delete-orphan")


class PayrollEntry(Base):
    """Bordro hesaplama kayıtları"""
    __tablename__ = "payroll_entries"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    payroll_period_id = Column(Integer, ForeignKey("payroll_periods.id"), nullable=False, index=True)

    worked_days = Column(Integer, default=0)
    remote_days = Column(Integer, default=0)
    weekend_days = Column(Integer, default=0)
    absent_days = Column(Integer, default=0)

    calculated_gross = Column(Float, default=0.0)
    sgk_base = Column(Float, default=0.0)
    income_tax_base = Column(Float, default=0.0)
    net_salary = Column(Float, default=0.0)

    income_tax_exemption_amount = Column(Float, default=0.0)
    stamp_tax_exemption_amount = Column(Float, default=0.0)
    sgk_employer_incentive_amount = Column(Float, default=0.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tenant = relationship("Tenant", back_populates="payroll_entries")
    employee = relationship("Employee", back_populates="payroll_entries")
    payroll_period = relationship("PayrollPeriod", back_populates="entries")


class SystemSetting(Base):
    """Sistem Ayarları - Key/Value deposu"""
    __tablename__ = "system_settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String)
    description = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class ExemptionReport(Base):
    """Teknokent Aylık Muafiyet Raporu"""
    __tablename__ = "exemption_reports"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    year = Column(Integer)
    month = Column(Integer)
    file_path = Column(String, nullable=True)  # PDF dosya yolu
    file_name = Column(String, nullable=True)  # Orijinal dosya adı
    notes = Column(Text, nullable=True)
    
    # Muhasebe özet bilgileri
    total_personnel_cost = Column(Float, default=0.0)  # Personel maliyeti
    total_rd_expense = Column(Float, default=0.0)  # Ar-Ge giderleri
    total_exempt_income = Column(Float, default=0.0)  # Muaf gelir
    total_taxable_income = Column(Float, default=0.0)  # Vergiye tabi gelir
    
    # 4691 S.K. Vergi İstisnaları
    corporate_tax_exemption_amount = Column(Float, default=0.0)  # Kurumlar Vergisi İstisnası (%25)
    vat_exemption_amount = Column(Float, default=0.0)  # KDV İstisnası (%20)
    personnel_income_tax_exemption_amount = Column(Float, default=0.0)  # Personel Gelir Vergisi İstisnası
    personnel_sgk_exemption_amount = Column(Float, default=0.0)  # SGK İşveren Hissesi Desteği
    personnel_stamp_tax_exemption_amount = Column(Float, default=0.0)  # Damga Vergisi İstisnası
    total_tax_advantage = Column(Float, default=0.0)  # Toplam Vergi Avantajı
    
    # 5746/4691 Sayılı Kanun - Girişim Sermayesi Yükümlülüğü
    venture_capital_obligation = Column(Float, default=0.0)  # %3 Girişim sermayesi yükümlülüğü tutarı
    is_venture_capital_invested = Column(Boolean, default=False)  # Girişim sermayesi yatırımı yapıldı mı?
    remote_work_ratio_applied = Column(Float, default=1.0)  # Uygulanan uzaktan çalışma oranı
    calculated_tax_advantage = Column(Float, default=0.0)  # Hesaplanan toplam vergi avantajı
    
    # İstisna Matrahı
    exemption_base = Column(Float, default=0.0)  # İstisna Matrahı (Muaf Gelir - Ar-Ge Gideri)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project")
    tenant = relationship("Tenant")