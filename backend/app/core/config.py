from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Backend API - Solucion Distribuida AWS"
    JWT_SECRET: str = "cambia-este-secreto-en-produccion-min-32-chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = 60
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    MAX_LOGIN_ATTEMPTS: int = 5
    BLOCK_SECONDS: int = 600
    # Postgres (VPS Backend: servicio `db` del compose, o RDS)
    DATABASE_URL: str = "postgresql+psycopg2://pos:pos123@db:5432/posdb"
    FIRST_PURCHASE_DISCOUNT: float = 0.15
    # Imagenes fuera de la DB: disco del servidor (volumen Docker)
    IMAGE_DIR: str = "./uploads"
    IMAGE_QUOTA_MB: int = 50
    MAX_IMAGE_MB: int = 2

    class Config:
        env_file = ".env"


settings = Settings()
