"""Puertos del dominio. La logica de negocio depende de esta interfaz;
la implementacion real llama a stored procedures de Postgres
(app/infrastructure/users_repo.py). Nada de SQL en el dominio."""
from abc import ABC, abstractmethod
from typing import Optional
from app.domain.user import User


class UserRepository(ABC):
    @abstractmethod
    def get_by_username(self, username: str) -> Optional[User]:
        raise NotImplementedError

    @abstractmethod
    def get_password_hash(self, username: str) -> Optional[str]:
        """Hash para verificar login (via SP; nunca se expone en API)."""
        raise NotImplementedError

    @abstractmethod
    def create(self, username: str, full_name: str,
               password_hash: str, role: str) -> int:
        raise NotImplementedError
