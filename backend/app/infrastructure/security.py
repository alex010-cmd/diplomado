"""Adaptador de seguridad JWT (PyJWT, mantenido activamente)."""
from datetime import datetime, timedelta, timezone
import jwt as pyjwt
from app.core.config import settings


def create_access_token(subject: str, extra: dict | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)
    payload = {"sub": subject, "exp": expire}
    if extra:
        payload.update(extra)
    return pyjwt.encode(payload, settings.JWT_SECRET,
                        algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    # Algoritmo fijo en lista blanca: rechaza "none" y confusion de alg.
    # Verifica firma + expiracion; el rol real se lee de la DB, no del token.
    try:
        return pyjwt.decode(token, settings.JWT_SECRET,
                            algorithms=[settings.JWT_ALGORITHM])
    except pyjwt.PyJWTError as exc:
        raise ValueError("Token invalido o expirado") from exc
