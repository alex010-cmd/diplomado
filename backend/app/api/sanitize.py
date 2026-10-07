"""Limpieza de datos de entrada (login y resto de endpoints).
Zero Trust: ningun dato del usuario se considera confiable; todo se
normaliza y valida antes de llegar a los stored procedures."""
import re
from fastapi import HTTPException

_USERNAME_RE = re.compile(r"^[a-z0-9._-]{3,30}$")
_SKU_RE = re.compile(r"^[A-Z0-9-]{1,20}$")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_HOLDER_RE = re.compile(r"^[a-z]:[A-Za-z0-9._-]{1,64}$")
_CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")


def clean_username(value: object) -> str:
    v = str(value or "").strip().lower()
    if not _USERNAME_RE.match(v):
        raise HTTPException(400, "Usuario invalido: 3-30 caracteres "
                                 "[a-z 0-9 . _ -]")
    return v


def clean_password(value: object) -> str:
    v = str(value or "")
    if not (6 <= len(v) <= 72):  # 72 = limite de bcrypt
        raise HTTPException(400, "Contrasena invalida: minimo 6 caracteres")
    return v


def clean_text(value: object, field: str, max_len: int = 120) -> str:
    v = str(value or "").strip()
    if not v or len(v) > max_len or _CONTROL_RE.search(v):
        raise HTTPException(400, f"{field} invalido")
    return v


def clean_sku(value: object) -> str:
    v = str(value or "").strip().upper()
    if not _SKU_RE.match(v):
        raise HTTPException(400, "SKU invalido: A-Z 0-9 - (max 20)")
    return v


def clean_email(value: object, required: bool = False) -> str:
    v = str(value or "").strip().lower()
    if not v:
        if required:
            raise HTTPException(400, "Correo invalido")
        return ""
    if len(v) > 120 or not _EMAIL_RE.match(v):
        raise HTTPException(400, "Correo invalido")
    return v


def clean_pay_method(value: object) -> str:
    v = str(value or "efectivo").strip().lower()
    if v not in ("efectivo", "tarjeta_debito", "tarjeta_credito",
                 "transferencia"):
        raise HTTPException(400, "Metodo de pago invalido")
    return v


def clean_image_url(value: object) -> str:
    v = str(value or "").strip()
    if not v:
        return ""
    ok_http = re.match(r"^https?://[^\s]{1,500}$", v)
    ok_local = re.match(r"^/images/[A-Za-z0-9._-]+$", v)
    if len(v) > 500 or not (ok_http or ok_local):
        raise HTTPException(400, "Imagen invalida: URL http(s) o /images/... max 500")
    return v


def clean_description(value: object, required: bool = False) -> str:
    v = str(value or "").strip()
    if not v:
        if required:
            raise HTTPException(400, "Caracteristicas invalidas")
        return ""
    if len(v) > 300 or _CONTROL_RE.search(v):
        raise HTTPException(400, "Caracteristicas invalidas (max 300)")
    return v


def clean_holder(value: object) -> str:
    v = str(value or "").strip()
    if not _HOLDER_RE.match(v):
        raise HTTPException(400, "Carrito invalido")
    return v


def clean_role(value: object) -> str:
    v = str(value or "").strip().lower()
    if v not in ("admin", "cliente"):
        raise HTTPException(400, "Rol invalido")
    return v
