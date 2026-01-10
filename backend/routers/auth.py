"""
Authentication Router - JWT Based Authentication
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
import hashlib
import secrets
import os
from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
)

# Simple token storage (in production use Redis or proper JWT)
SECRET_KEY = os.getenv("SECRET_KEY", "minierp-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token", auto_error=False)

# Simple in-memory token store (use Redis in production)
active_tokens = {}


def hash_password(password: str) -> str:
    """Hash password with salt"""
    salt = SECRET_KEY[:16]
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password"""
    return hash_password(plain_password) == hashed_password


def create_access_token(email: str) -> str:
    """Create a simple token"""
    token = secrets.token_urlsafe(32)
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    active_tokens[token] = {"email": email, "expire": expire}
    return token


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    """Get current user from token"""
    if not token:
        return None
    
    token_data = active_tokens.get(token)
    if not token_data:
        return None
    
    if datetime.utcnow() > token_data["expire"]:
        del active_tokens[token]
        return None
    
    user = db.query(models.User).filter(
        models.User.email == token_data["email"]
    ).first()
    return user


def get_current_active_user(
    current_user: Optional[models.User] = Depends(get_current_user)
) -> models.User:
    """Require authenticated user"""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


@router.post("/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Register new user"""
    # Check if user exists
    existing = db.query(models.User).filter(
        models.User.email == user.email
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_user = models.User(
        email=user.email,
        hashed_password=hash_password(user.password),
        full_name=user.full_name,
        is_active=True,
        is_superuser=False
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/token", response_model=schemas.Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login and get access token"""
    user = db.query(models.User).filter(
        models.User.email == form_data.username
    ).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    access_token = create_access_token(user.email)
    return schemas.Token(access_token=access_token)


@router.post("/login", response_model=schemas.Token)
def login_json(login_data: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Login with JSON body"""
    user = db.query(models.User).filter(
        models.User.email == login_data.email
    ).first()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    access_token = create_access_token(user.email)
    return schemas.Token(access_token=access_token)


@router.get("/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(get_current_active_user)):
    """Get current user info"""
    return current_user


@router.post("/logout")
def logout(token: str = Depends(oauth2_scheme)):
    """Logout and invalidate token"""
    if token and token in active_tokens:
        del active_tokens[token]
    return {"message": "Logged out successfully"}
