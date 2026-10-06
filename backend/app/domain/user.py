"""Dominio: entidades puras. Se construyen desde filas devueltas
por los stored procedures; el dominio no conoce SQL ni FastAPI."""
from dataclasses import dataclass


@dataclass
class User:
    id: int
    username: str
    full_name: str
    role: str  # admin | cliente
    first_purchase_done: bool = False
    disabled: bool = False
    email: str = ""
    address: str = ""
