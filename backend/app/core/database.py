"""
database.py — SQLAlchemy engine, session factory, and FastAPI dependency.

In phase 1, DATABASE_URL points to a local SQLite file.
In phase 2, swap it to a PostgreSQL URL — the models and Alembic
migrations work identically on both backends.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from .config import settings

# connect_args is SQLite-specific; PostgreSQL ignores it.
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=settings.SQL_ECHO,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency that yields a database session and ensures cleanup."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
