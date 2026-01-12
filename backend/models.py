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
    ORDER_RECEIVED = "Order Received"
    INVOICED = "Invoiced"
    LOST = "Lost"

class QuoteStatus(str, enum.Enum):
    DRAFT = "Draft"
    SENT = "Sent"
    ACCEPTED = "Accepted"
    REJECTED = "Rejected"

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

class Account(Base):
    """Unified account for both Customers (Müşteri) and Suppliers (Tedarikçi)"""
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    account_type = Column(String, default=AccountType.CUSTOMER)
    entity_type = Column(String, default=CustomerType.CORPORATE)
    title = Column(String, index=True)
    tax_id = Column(String)
    tax_office = Column(String)
    address = Column(String)
    phone = Column(String)
    email = Column(String)
    receivable_balance = Column(Float, default=0.0)
    payable_balance = Column(Float, default=0.0)

    deals = relationship("Deal", back_populates="account")
    invoices = relationship("Invoice", back_populates="account")
    transactions = relationship("Transaction", back_populates="account")

# Keep Customer as alias for backward compatibility
Customer = Account

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
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

class Deal(Base):
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True, index=True)
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

class Quote(Base):
    """Teklif - Fırsata bağlı fiyat teklifi"""
    __tablename__ = "quotes"

    id = Column(Integer, primary_key=True, index=True)
    quote_no = Column(String, index=True)
    deal_id = Column(Integer, ForeignKey("deals.id"))
    account_id = Column(Integer, ForeignKey("accounts.id"))
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
    project = relationship("Project", back_populates="quotes")
    items = relationship("QuoteItem", back_populates="quote", cascade="all, delete-orphan")

class QuoteItem(Base):
    """Teklif Kalemi"""
    __tablename__ = "quote_items"

    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey("quotes.id"))
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    description = Column(String)
    quantity = Column(Float)
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
    deal_id = Column(Integer, ForeignKey("deals.id"))
    quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=True)
    status = Column(String)
    total_amount = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    deal = relationship("Deal", back_populates="orders")
    invoice = relationship("Invoice", uselist=False, back_populates="order")

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
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

class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"))
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    description = Column(String)
    quantity = Column(Float)
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

    @property
    def amount(self):
        return self.debit - self.credit


# ==================== NEW MODELS ====================

class Project(Base):
    """Ar-Ge Proje Yönetimi"""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
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


class FinancialAccount(Base):
    """Kasa ve Banka Hesapları"""
    __tablename__ = "financial_accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    account_type = Column(String, default=FinancialAccountType.CASH)
    currency = Column(String, default=Currency.TRY)
    balance = Column(Float, default=0.0)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Contact(Base):
    """Firma Çalışanları / İletişim Kişileri"""
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"))
    first_name = Column(String)
    last_name = Column(String)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    role = Column(String, nullable=True)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    account = relationship("Account")


class Activity(Base):
    """CRM Aktiviteleri - Görüşme, Toplantı, Not"""
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
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


class User(Base):
    """Sistem Kullanıcıları"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SystemSetting(Base):
    """Sistem Ayarları - Key/Value deposu"""
    __tablename__ = "system_settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String)
    description = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
