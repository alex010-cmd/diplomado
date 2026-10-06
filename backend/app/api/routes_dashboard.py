from fastapi import APIRouter, Depends
from app.api import deps

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
def dashboard(current=Depends(deps.get_current_user)):
    """Recurso protegido: requiere JWT valido. Devuelve datos de ejemplo."""
    return {
        "bienvenida": f"Hola {current['username']}",
        "rol": current["role"],
        "kpis": [
            {"titulo": "Usuarios activos", "valor": 128, "detalle": "+12 esta semana"},
            {"titulo": "Peticiones API (24h)", "valor": 4521, "detalle": "99.2% exitosas"},
            {"titulo": "Intentos bloqueados", "valor": 17, "detalle": "Fail2Ban + rate-limit"},
            {"titulo": "Estado VPC Peering", "valor": "OK", "detalle": "Conectividad privada"},
        ],
        "arquitectura": {
            "frontend": "React + Vite (VPC Frontend)",
            "backend": "FastAPI hexagonal (VPC Backend)",
            "auth": "JWT Bearer",
            "transporte": "HTTPS + VPC Peering privado",
        },
    }


@router.get("/health")
def health():
    return {"status": "ok"}
