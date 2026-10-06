"""Adaptador de persistencia. Hoy es en memoria (demo); manana puede ser
RDS/Postgres sin tocar el dominio ni los casos de uso."""
from typing import Optional
from passlib.context import CryptContext
from app.domain.ports import UserRepository
from app.domain.user import User

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


class InMemoryUserRepository(UserRepository):
    def __init__(self):
        # Usuario demo: admin / Admin123*
        self._users = {
            "admin": User(
                username="admin",
                full_name="Administrador Demo",
                role="admin",
                password_hash=hash_password("Admin123*"),
            )
        }

    def get_by_username(self, username: str) -> Optional[User]:
        return self._users.get(username.strip().lower())
