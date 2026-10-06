"""Casos de uso / lógica de negocio. No conoce FastAPI, ni JWT, ni BD."""
from typing import Optional
from app.domain.ports import UserRepository
from app.domain.user import User


class AuthService:
    def __init__(self, users: UserRepository, verify_password, create_token):
        self._users = users
        self._verify_password = verify_password
        self._create_token = create_token

    def login(self, username: str, password: str) -> Optional[dict]:
        user: Optional[User] = self._users.get_by_username(username.strip().lower())
        if not user or user.disabled:
            return None
        if not self._verify_password(password, user.password_hash):
            return None
        token = self._create_token(subject=user.username, extra={"role": user.role})
        return {
            "access_token": token,
            "token_type": "bearer",
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
        }

    def get_profile(self, username: str) -> Optional[dict]:
        user = self._users.get_by_username(username)
        if not user:
            return None
        return {
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
        }
