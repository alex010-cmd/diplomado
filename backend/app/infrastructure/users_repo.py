"""Adaptador de usuarios: SOLO stored procedures (sp_*).
Sin ORM, sin SELECT directos a tablas, sin datos en memoria."""
import bcrypt
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import Optional
from app.domain.ports import UserRepository
from app.domain.user import User


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"),
                         bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def _row_to_user(r) -> User:
    return User(id=r.o_id, username=r.o_username, full_name=r.o_full_name,
                role=r.o_role, first_purchase_done=r.o_first_purchase_done,
                disabled=r.o_disabled, email=r.o_email or "",
                address=r.o_address or "")


class SpUserRepository(UserRepository):
    def __init__(self, db: Session):
        self._db = db

    def get_by_username(self, username: str) -> Optional[User]:
        row = self._db.execute(
            text("SELECT * FROM sp_get_user_by_username(:u)"),
            {"u": username.strip().lower()}).fetchone()
        return _row_to_user(row) if row else None

    def get_password_hash(self, username: str) -> Optional[str]:
        row = self._db.execute(
            text("SELECT o_password_hash FROM sp_get_user_by_username(:u)"),
            {"u": username.strip().lower()}).fetchone()
        return row[0] if row else None

    def create(self, username: str, full_name: str, password_hash: str,
               role: str, email: str = "") -> int:
        return self._db.execute(
            text("SELECT sp_create_user(:u,:n,:h,:r,:e)"),
            {"u": username.strip().lower(), "n": full_name,
             "h": password_hash, "r": role, "e": email}).scalar()

    def update_profile(self, user_id: int, full_name: str, email: str,
                       address: str):
        self._db.execute(
            text("SELECT sp_update_profile(:i,:n,:e,:a)"),
            {"i": user_id, "n": full_name, "e": email, "a": address})

    def set_password(self, user_id: int, password_hash: str):
        self._db.execute(text("SELECT sp_set_password(:i,:h)"),
                         {"i": user_id, "h": password_hash})
