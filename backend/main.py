import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import accounts, products, sales, finance, projects, financial_accounts, contacts, activities, auth, reports

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MiniERP API",
    description="Pre-Accounting, CRM & Project Management System for Pikolab Arge",
    version="2.0.0"
)

# CORS - Production destekli
# Environment variable'dan ek origin'ler alınabilir (virgülle ayrılmış)
default_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:5177",
    "http://localhost:5178",
    "http://localhost:3000",
    "http://localhost",
    "http://localhost:80",
]

# Production origin'leri ekle (CORS_ORIGINS env var'dan)
extra_origins = os.getenv("CORS_ORIGINS", "").split(",")
origins = default_origins + [o.strip() for o in extra_origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(products.router)
app.include_router(sales.router)
app.include_router(finance.router)
app.include_router(projects.router)
app.include_router(financial_accounts.router)
app.include_router(contacts.router)
app.include_router(activities.router)
from .routers import exemption_reports
app.include_router(exemption_reports.router)
app.include_router(reports.router)
from .routers import settings
app.include_router(settings.router)

# Legacy endpoint for backward compatibility
@app.get("/customers")
def legacy_customers():
    from .database import SessionLocal
    from . import models
    db = SessionLocal()
    try:
        accounts = db.query(models.Account).filter(
            models.Account.account_type.in_([models.AccountType.CUSTOMER, models.AccountType.BOTH])
        ).all()
        return [{"id": a.id, "type": a.entity_type, "title": a.title, "tax_id": a.tax_id, 
                 "phone": a.phone, "email": a.email, "balance": a.receivable_balance} for a in accounts]
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "MiniERP API is running"}

@app.get("/health")
def health_check():
    """Health check endpoint for Coolify and container orchestration."""
    return {"status": "healthy", "service": "minierp-backend", "version": "2.0.0"}
