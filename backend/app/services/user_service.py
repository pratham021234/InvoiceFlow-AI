from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash, verify_password


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    normalized_email = email.strip().lower()
    return db.query(User).filter(User.email == normalized_email).first()


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user_in: UserCreate) -> User:
    normalized_email = user_in.email.strip().lower()
    existing_user = get_user_by_email(db, normalized_email)
    if existing_user:
        raise ValueError("An account with this email address already exists.")

    hashed_pw = get_password_hash(user_in.password)
    db_user = User(
        email=normalized_email,
        hashed_password=hashed_pw,
        full_name=user_in.full_name.strip(),
        is_active=True,
        email_verified=False,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user
