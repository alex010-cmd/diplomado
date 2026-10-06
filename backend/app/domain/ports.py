"""Puertos (interfaces) del dominio. La lógica de negocio depende de esto,
no de implementaciones concretas (principio de inversión de dependencias)."""
from abc import ABC, abstractmethod
from typing import Optional
from app.domain.user import User


class UserRepository(ABC):
    @abstractmethod
    def get_by_username(self, username: str) -> Optional[User]:
        raise NotImplementedError
