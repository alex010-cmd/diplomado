"""Bloqueo temporal por IP ante intentos fallidos (complemento a Fail2Ban).
Fail2Ban actua a nivel SO bloqueando en iptables; esto protege a nivel app
aunque el backend este detras del peering privado."""
import time
from app.core.config import settings

_attempts: dict[str, list[float]] = {}


def _clean(ip: str, now: float):
    window = settings.BLOCK_SECONDS
    _attempts[ip] = [t for t in _attempts.get(ip, []) if now - t < window]


def is_blocked(ip: str) -> bool:
    now = time.time()
    _clean(ip, now)
    return len(_attempts.get(ip, [])) >= settings.MAX_LOGIN_ATTEMPTS


def register_failure(ip: str):
    now = time.time()
    _clean(ip, now)
    _attempts.setdefault(ip, []).append(now)


def register_success(ip: str):
    _attempts.pop(ip, None)
