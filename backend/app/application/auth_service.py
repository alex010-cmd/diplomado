"""Casos de uso de autenticacion. No conoce FastAPI, JWT ni Postgres:
solo el puerto UserRepository (implementado con stored procedures)."""
from typing import Optional
from app.domain.ports import UserRepository


class AuthService:
    def __init__(self, users: UserRepository, verify_password, create_token):
        self._users = users
        self._verify_password = verify_password
        self._create_token = create_token

    def login(self, username: str, password: str) -> Optional[dict]:
        username = username.strip().lower()
        user = self._users.get_by_username(username)
        if not user or user.disabled:
            return None
        # bcrypt no existe en Postgres: el hash viaja por SP y se
        # verifica aqui en la app; jamas sale en respuestas API.
        if not self._verify_password(password,
                                     self._users.get_password_hash(username)):
            return None
        token = self._create_token(subject=user.username,
                                   extra={"role": user.role})
        return {"access_token": token, "token_type": "bearer",
                "username": user.username, "full_name": user.full_name,
                "role": user.role,
                "first_purchase_done": user.first_purchase_done,
                "email": user.email}
