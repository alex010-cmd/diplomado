import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.api import deps, schemas
from app.application.auth_service import AuthService
from app.infrastructure import rate_limit
from app.infrastructure.security import create_access_token
from app.infrastructure.users_repo import InMemoryUserRepository, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger("uvicorn.error")

_repo = InMemoryUserRepository()
_service = AuthService(
    users=_repo, verify_password=verify_password, create_token=create_access_token
)


def _client_ip(request: Request) -> str:
    # Si hay un proxy/Nginx delante, respeta X-Forwarded-For
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=schemas.LoginResponse)
def login(body: schemas.LoginRequest, request: Request):
    ip = _client_ip(request)
    if rate_limit.is_blocked(ip):
        log.warning("LOGIN BLOQUEADO por intentos repetidos desde IP %s", ip)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos fallidos. IP bloqueada temporalmente.",
        )
    result = _service.login(body.username, body.password)
    if not result:
        rate_limit.register_failure(ip)
        # Log con formato apto para Fail2Ban: "LOGIN FAILED ... from <IP>"
        log.warning("LOGIN FAILED usuario=%s from %s", body.username, ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales invalidas",
        )
    rate_limit.register_success(ip)
    log.info("LOGIN OK usuario=%s from %s", body.username, ip)
    return result


@router.get("/me", response_model=schemas.ProfileResponse)
def me(current=Depends(deps.get_current_user)):
    profile = _service.get_profile(current["username"])
    if not profile:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return profile
