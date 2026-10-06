"""Conexion a Postgres. La API usa el rol `pos` (minimo privilegio:
solo EXECUTE en stored procedures, sin acceso directo a tablas).
El esquema lo crea el job db-init / entrypoint con db/init.sql."""
import time
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def wait_for_db(retries: int = 30, delay: float = 2.0):
    """Espera a que Postgres responda y a que existan los SPs."""
    last = None
    for _ in range(retries):
        try:
            with engine.connect() as c:
                c.execute(text("SELECT * FROM sp_list_products() LIMIT 1"))
            return
        except Exception as exc:  # noqa: BLE001 - reintento de arranque
            last = exc
            time.sleep(delay)
    raise RuntimeError(f"Postgres no disponible o sin inicializar: {last}")


def run_init_sql(path: str, admin_url: str):
    """Aplica db/init.sql como superusuario (job db-init o despliegue
    manual con psql). Idempotente."""
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with open(path, encoding="utf-8") as f:
        sql = f.read()
    with admin_engine.connect() as c:
        c.execute(text(sql))
