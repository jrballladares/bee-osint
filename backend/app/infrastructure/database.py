from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.core.config import settings


def create_database_if_not_exists(database_url: str):
    url = make_url(database_url)
    if not url.drivername.startswith("postgresql"):
        return

    db_name = url.database
    default_db_url = url.set(database="postgres")
    engine = create_engine(default_db_url, isolation_level="AUTOCOMMIT")

    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname=:name"),
            {"name": db_name},
        )
        exists = result.scalar()

        if not exists:
            conn.execute(text(f'CREATE DATABASE "{db_name}"'))


create_database_if_not_exists(settings.DATABASE_URL)


engine_kwargs = {
    "future": True,
    "pool_pre_ping": True,
}

if settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
