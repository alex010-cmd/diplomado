from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import deps
from app.domain.user import User
from app.infrastructure import pos_repo
from app.infrastructure.db import get_db

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db),
              current: User = Depends(deps.get_current_user)):
    """KPIs reales calculados en la DB (sp_dashboard_stats)."""
    stats = pos_repo.dashboard_stats(db)
    lows = pos_repo.low_stock(db)
    kpis = [
        {"titulo": "Ventas totales", "valor": stats["ventas"],
         "detalle": "sp_list_sales"},
        {"titulo": "Ingresos", "valor": stats["ingresos"],
         "detalle": "suma de ventas"},
        {"titulo": "Alertas de stock", "valor": stats["alertas"],
         "detalle": "productos con menos de 5"},
        {"titulo": "Usuarios", "valor": stats["usuarios"],
         "detalle": "admin+clientes"},
    ]
    data = {"bienvenida": f"Hola {current.username}", "rol": current.role,
            "kpis": kpis, "bajo_stock": lows,
            "arquitectura": {
                "frontend": "React + Vite (VPC Frontend)",
                "backend": "FastAPI hexagonal (VPC Backend)",
                "datos": "Postgres, acceso solo via stored procedures",
                "auth": "JWT Bearer + roles",
                "transporte": "HTTPS + VPC Peering privado"}}
    return data
