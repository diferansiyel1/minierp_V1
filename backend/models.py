from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum, Text
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

class Deal(Base):
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    source = Column(String)
    status = Column(String, default=DealStatus.LEAD)
    probability = Column(Float, default=0.0)
    estimated_value = Column(Float, default=0.0)
    account_id = Column(Integer, ForeignKey("accounts.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    account = relationship("Account", back_populates="deals")
    quotes = relationship("Quote", back_populates="deal")
    orders = relationship("Order", back_populates="deal")

class Quote(Base):
    """Teklif - Fırsata bağlı fiyat teklifi"""
    __tablename__ = "quotes"

    id = Column(Integer, primary_key=True, index=True)
    quote_no = Column(String, index=True)
    deal_id = Column(Integer, ForeignKey("deals.id"))
    account_id = Column(Integer, ForeignKey("accounts.id"))
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
    currency = Column(String, default=Currency.TRY)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    issue_date = Column(DateTime(timezone=True), server_default=func.now())
    due_date = Column(DateTime(timezone=True))
    subtotal = Column(Float, default=0.0)
    vat_amount = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    status = Column(String, default="Draft")

    account = relationship("Account", back_populates="invoices")
    order = relationship("Order", back_populates="invoice")
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
    line_total = Column(Float)
    vat_amount = Column(Float)
    total_with_vat = Column(Float)

    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product")

class Transaction(Base):
    """
    Finansal Hareket - Çift taraflı muhasebe mantığı
    - Sales Invoice: Müşteri Borç (+receivable)
    - Purchase Invoice: Tedarikçi Alacak (+payable)
    - Collection: Müşteri Alacak (-receivable)
    - Payment: Tedarikçi Borç (-payable)
    """
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"))
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    transaction_type = Column(String)
    debit = Column(Float, default=0.0)
    credit = Column(Float, default=0.0)
    date = Column(DateTime(timezone=True), server_default=func.now())
    description = Column(String)

    account = relationship("Account", back_populates="transactions")
    invoice = relationship("Invoice", back_populates="transactions")

    @property
    def amount(self):
        return self.debit - self.credit
