from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.domain.user import User
from app.infrastructure.db import get_db
from app.infrastructure.security import decode_token
from app.infrastructure.users_repo import SpUserRepository

bearer_strict = HTTPBearer(auto_error=True)
bearer_optional = HTTPBearer(auto_error=False)


def _user_from_token(token: str, db: Session) -> User:
    payload = decode_token(token)  # lanza ValueError si es invalido
    user = SpUserRepository(db).get_by_username(payload.get("sub") or "")
    if not user or user.disabled:
        raise ValueError("Usuario no valido")
    return user


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_strict),
    db: Session = Depends(get_db),
) -> User:
    try:
        return _user_from_token(creds.credentials, db)
    except ValueError:
        raise HTTPException(status_code=401, detail="Token invalido o expirado")


def get_optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_optional),
    db: Session = Depends(get_db),
) -> User | None:
    """Checkout invitado: sin token -> None; con token valido -> User."""
    if not creds:
        return None
    try:
        return _user_from_token(creds.credentials, db)
    except ValueError:
        return None


def require_roles(*roles: str):
    def _check(current: User = Depends(get_current_user)) -> User:
        if current.role not in roles:
            raise HTTPException(status_code=403,
                                detail="Sin permiso (rol insuficiente)")
        return current
    return _check
