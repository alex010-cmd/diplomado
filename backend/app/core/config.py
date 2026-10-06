from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Backend API - Solucion Distribuida AWS"
    JWT_SECRET: str = "cambia-este-secreto-en-produccion-min-32-chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = 60
    # CORS: origen exacto del frontend (VPS Frontend o dominio HTTPS)
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    # Rate-limit complementario a Fail2Ban (intentos fallidos por IP)
    MAX_LOGIN_ATTEMPTS: int = 5
    BLOCK_SECONDS: int = 600

    class Config:
        env_file = ".env"


settings = Settings()
