from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import accounts, products, sales, finance

Base.metadata.create_all(bind=engine)

app = FastAPI(title="MiniERP API", description="Pre-Accounting & CRM System for Turkish Market")

# CORS
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(accounts.router)
app.include_router(products.router)
app.include_router(sales.router)
app.include_router(finance.router)

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
