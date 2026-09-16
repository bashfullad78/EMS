"""SQLAlchemy engine/session setup shared by the app, seed script and tests."""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


# psycopg3 URLs use postgresql://; normalise to the sqlalchemy+psycopg dialect.
_db_url = settings.DATABASE_URL
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql+psycopg://", 1)
elif _db_url.startswith("postgresql://"):
    _db_url = _db_url.replace("postgresql://", "postgresql+psycopg://", 1)

# SQLite needs check_same_thread=False for FastAPI's threadpool usage.
_connect_args = {"check_same_thread": False} if _db_url.startswith("sqlite") else {}

engine = create_engine(
    _db_url,
    echo=settings.DB_ECHO_LOG,
    connect_args=_connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
