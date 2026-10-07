import logging
from fastapi import (APIRouter, Depends, HTTPException, Request, Response,
                     status)
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session
from app.api import deps, sanitize, schemas
from app.application.auth_service import AuthService
from app.core.config import settings
from app.domain.user import User
from app.infrastructure import pos_repo, rate_limit
from app.infrastructure.db import get_db
from app.infrastructure.security import create_access_token
from app.infrastructure.users_repo import (SpUserRepository, hash_password,
                                           verify_password)

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger("uvicorn.error")

COOKIE_NAME = "access_token"


def _service(db: Session) -> AuthService:
    return AuthService(users=SpUserRepository(db),
                       verify_password=verify_password,
                       create_token=create_access_token)


def _set_auth_cookie(response: Response, token: str):
    """Cookie HttpOnly: el JS del navegador no puede leer el token."""
    response.set_cookie(
        key=COOKIE_NAME, value=token, httponly=True, samesite="lax",
        secure=settings.COOKIE_SECURE,
        max_age=settings.ACCESS_TOKEN_MINUTES * 60, path="/")


def _public(result: dict) -> dict:
    """Quita el token: solo queda la informacion publica del usuario."""
    result = dict(result)
    result.pop("access_token", None)
    result.pop("token_type", None)
    return result


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=schemas.LoginResponse)
def login(body: schemas.LoginRequest, request: Request, response: Response,
          db: Session = Depends(get_db)):
    # Limpieza: normaliza y valida antes de consultar (vía SP)
    username = sanitize.clean_username(body.username)
    password = sanitize.clean_password(body.password)
    ip = _client_ip(request)
    if rate_limit.is_blocked(ip):
        log.warning("LOGIN BLOQUEADO por intentos repetidos desde IP %s", ip)
        raise HTTPException(429, "Demasiados intentos. IP bloqueada temporalmente.")
    result = _service(db).login(username, password)
    if not result:
        rate_limit.register_failure(ip)
        # Formato apto para Fail2Ban: "LOGIN FAILED ... from <IP>"
        log.warning("LOGIN FAILED usuario=%s from %s", username, ip)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED,
                            "Credenciales invalidas")
    rate_limit.register_success(ip)
    log.info("LOGIN OK usuario=%s from %s", username, ip)
    _set_auth_cookie(response, result["access_token"])
    return _public(result)


@router.post("/register", response_model=schemas.LoginResponse,
             status_code=201)
def register(body: schemas.RegisterRequest, response: Response,
             db: Session = Depends(get_db)):
    """Registro publico de clientes (para futuros descuentos).
    El invitado compra sin descuento; registrado: 15% en su 1ra compra."""
    username = sanitize.clean_username(body.username)
    password = sanitize.clean_password(body.password)
    full_name = sanitize.clean_text(body.full_name or username,
                                    "Nombre", 120)
    email = sanitize.clean_email(body.email, required=True)
    try:
        SpUserRepository(db).create(username, full_name,
                                    hash_password(password), "cliente",
                                    email)
        db.commit()
    except DBAPIError as exc:
        db.rollback()
        msg = str(exc.orig) if exc.orig else ""
        if "EMAIL_EXISTE" in msg:
            raise HTTPException(409, "Ese correo ya esta registrado")
        raise HTTPException(409, "Ese usuario ya existe")
    result = _service(db).login(username, password)
    log.info("REGISTER cliente=%s", username)
    _set_auth_cookie(response, result["access_token"])
    return _public(result)


@router.post("/logout")
def logout(response: Response):
    """Cierra la sesion: borra la cookie HttpOnly."""
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/users")
def list_users(db: Session = Depends(get_db),
               current: User = Depends(deps.require_roles("admin"))):
    return pos_repo.list_users(db)


@router.get("/me", response_model=schemas.ProfileResponse)
def me(current: User = Depends(deps.get_current_user)):
    return {"username": current.username, "full_name": current.full_name,
            "role": current.role,
            "first_purchase_done": current.first_purchase_done,
            "email": current.email, "address": current.address}


@router.patch("/me", response_model=schemas.ProfileResponse)
def update_me(body: schemas.UpdateProfileRequest,
              db: Session = Depends(get_db),
              current: User = Depends(deps.get_current_user)):
    """Engrane: cambiar nombre, correo y direccion de entrega."""
    full_name = sanitize.clean_text(body.full_name or current.full_name,
                                    "Nombre", 120)
    email = sanitize.clean_email(body.email or current.email)
    address = sanitize.clean_text(body.address or current.address or "-",
                                  "Direccion", 200)
    if body.address is not None and not body.address.strip():
        address = ""
    try:
        SpUserRepository(db).update_profile(current.id, full_name,
                                            email, address)
        db.commit()
    except DBAPIError as exc:
        db.rollback()
        msg = str(exc.orig) if exc.orig else ""
        if "EMAIL_EXISTE" in msg:
            raise HTTPException(409, "Ese correo ya esta registrado")
        if "EMAIL_INVALIDO" in msg:
            raise HTTPException(400, "Correo invalido")
        raise HTTPException(400, "No se pudo actualizar el perfil")
    updated = SpUserRepository(db).get_by_username(current.username)
    return {"username": updated.username, "full_name": updated.full_name,
            "role": updated.role,
            "first_purchase_done": updated.first_purchase_done,
            "email": updated.email, "address": updated.address}


@router.post("/password")
def change_password(body: schemas.ChangePasswordRequest,
                    db: Session = Depends(get_db),
                    current: User = Depends(deps.get_current_user)):
    """Engrane: cambiar contrasena verificando la actual."""
    repo = SpUserRepository(db)
    old_hash = repo.get_password_hash(current.username)
    if not old_hash or not verify_password(body.current_password,
                                            old_hash):
        raise HTTPException(401, "La contrasena actual no coincide")
    new = sanitize.clean_password(body.new_password)
    repo.set_password(current.id, hash_password(new))
    db.commit()
    log.info("PASSWORD cambio %s", current.username)
    return {"ok": True}
