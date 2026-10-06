import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from app.api.routes_auth import router as auth_router
from app.api.routes_dashboard import router as dash_router
from app.api.routes_images import router as img_router
from app.api.routes_pos import router as pos_router
from app.core.config import settings
from app.infrastructure.db import wait_for_db


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        resp = await call_next(request)
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        resp.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        resp.headers["Content-Security-Policy"] = "default-src 'self'"
        return resp


@asynccontextmanager
async def lifespan(app: FastAPI):
    wait_for_db()  # Postgres + SPs listos (los crea db-init/init.sql)
    yield


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

# Zero Trust: CORS cerrado al origen exacto del frontend, no "*"
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(SecurityHeadersMiddleware)

app.include_router(auth_router)
app.include_router(dash_router)
app.include_router(img_router)
app.include_router(pos_router)

# Imagenes fuera de la DB: archivos en disco (volumen Docker)
os.makedirs(settings.IMAGE_DIR, exist_ok=True)
app.mount("/images", StaticFiles(directory=settings.IMAGE_DIR),
            name="images")
