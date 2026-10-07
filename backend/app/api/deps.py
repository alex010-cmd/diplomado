from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.domain.user import User
from app.infrastructure.db import get_db
from app.infrastructure.security import decode_token
from app.infrastructure.users_repo import SpUserRepository

# El JWT viaja SOLO en la cookie HttpOnly (sin Bearer, sin localStorage):
# un XSS en la pagina no puede leerla ni robarla.
COOKIE_NAME = "access_token"


def _user_from_token(token: str, db: Session) -> User:
    payload = decode_token(token)  # lanza ValueError si es invalido
    user = SpUserRepository(db).get_by_username(payload.get("sub") or "")
    if not user or user.disabled:
        raise ValueError("Usuario no valido")
    return user


def get_current_user(request: Request,
                     db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        return _user_from_token(token, db)
    except ValueError:
        raise HTTPException(status_code=401, detail="Token invalido o expirado")


def get_optional_user(request: Request,
                      db: Session = Depends(get_db)) -> User | None:
    """Sin cookie -> None; con cookie valida -> User."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    try:
        return _user_from_token(token, db)
    except ValueError:
        return None


def require_roles(*roles: str):
    def _check(current: User = Depends(get_current_user)) -> User:
        if current.role not in roles:
            raise HTTPException(status_code=403,
                                detail="Sin permiso (rol insuficiente)")
        return current
    return _check
