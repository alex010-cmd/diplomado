"""Imagenes de productos FUERA de la DB (disco del servidor).
En la DB solo se guarda la ruta (/images/<id>.<ext>).
Cuota total para no llenar el disco + aviso de uso al admin."""
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.api import deps
from app.core.config import settings
from app.domain.user import User
from app.infrastructure import pos_repo
from app.infrastructure.db import get_db

router = APIRouter(prefix="/api", tags=["images"])

ALLOWED = {".jpg": b"\xff\xd8\xff", ".jpeg": b"\xff\xd8\xff",
           ".png": b"\x89PNG", ".webp": b"RIFF", ".gif": b"GIF8"}


def _usage_bytes() -> int:
    total = 0
    d = settings.IMAGE_DIR
    if os.path.isdir(d):
        for f in os.listdir(d):
            p = os.path.join(d, f)
            if os.path.isfile(p):
                total += os.path.getsize(p)
    return total


@router.get("/images/usage")
def usage(db: Session = Depends(get_db),
          current: User = Depends(deps.require_roles("admin"))):
    quota = settings.IMAGE_QUOTA_MB * 1024 * 1024
    return {"used_bytes": _usage_bytes(), "quota_bytes": quota,
            "quota_mb": settings.IMAGE_QUOTA_MB}


@router.post("/products/{product_id}/image")
async def upload_image(product_id: int, file: UploadFile,
                       db: Session = Depends(get_db),
                       current: User = Depends(deps.require_roles("admin"))):
    """Sube imagen (max 2MB, jpg/png/webp/gif). Sugiere pocas imagenes:
    el servidor tiene cuota limitada (ver /images/usage)."""
    if product_id <= 0:
        raise HTTPException(400, "Producto invalido")
    name = (file.filename or "").lower()
    ext = os.path.splitext(name)[1]
    if ext not in ALLOWED:
        raise HTTPException(400, "Formato invalido: jpg, png, webp o gif")
    data = await file.read()
    max_bytes = settings.MAX_IMAGE_MB * 1024 * 1024
    if not data or len(data) > max_bytes:
        raise HTTPException(400, f"Imagen invalida: max {settings.MAX_IMAGE_MB}MB")
    if not data.startswith(ALLOWED[ext]) or (ext == ".webp" and b"WEBP" not in data[:16]):
        raise HTTPException(400, "Archivo no es una imagen valida")
    os.makedirs(settings.IMAGE_DIR, exist_ok=True)
    quota = settings.IMAGE_QUOTA_MB * 1024 * 1024
    if _usage_bytes() + len(data) > quota:
        raise HTTPException(413, "Sin espacio para imagenes: elimina alguna "
                                 "o agrega pocas imagenes (cuota llena)")
    # Nombre determinista: sin path traversal posible
    for old_ext in ALLOWED:
        old = os.path.join(settings.IMAGE_DIR, f"{product_id}{old_ext}")
        if os.path.isfile(old):
            os.remove(old)
    dest = os.path.join(settings.IMAGE_DIR, f"{product_id}{ext}")
    with open(dest, "wb") as f:
        f.write(data)
    try:
        return pos_repo.update_product(db, product_id, None, None,
                                       f"/images/{product_id}{ext}")
    except Exception:
        if os.path.isfile(dest):
            os.remove(dest)  # no dejar huerfanos si falla la DB
        raise
