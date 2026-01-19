from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db
from .auth import get_current_active_user

router = APIRouter(
    prefix="/products",
    tags=["products"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=schemas.Product)
def create_product(
    product: schemas.ProductCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    product_data = product.dict()
    # Automatically assign the tenant from the current user
    if current_user.tenant_id:
        product_data["tenant_id"] = current_user.tenant_id
        
    db_product = models.Product(**product_data)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@router.get("/", response_model=List[schemas.Product])
def read_products(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    # Filter products by tenant
    query = db.query(models.Product)
    if current_user.tenant_id:
        query = query.filter(models.Product.tenant_id == current_user.tenant_id)
        
    products = query.offset(skip).limit(limit).all()
    return products
