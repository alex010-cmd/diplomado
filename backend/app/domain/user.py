"""Dominio: entidades puras, sin dependencias de frameworks ni BD."""
from dataclasses import dataclass


@dataclass
class User:
    username: str
    full_name: str
    role: str
    password_hash: str
    disabled: bool = False
