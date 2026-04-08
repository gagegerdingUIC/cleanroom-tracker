"""
base.py — Shared DeclarativeBase and entity mixin.

Every model inherits from Base (for SQLAlchemy metadata) and
EntityMixin (for the four common columns: id, created_at, updated_at,
owner_id).  This keeps the common scaffold DRY and ensures the pattern
is enforced across the entire schema from day one, supporting the
future multi-user / LIMS access-control layer without migrations.

UUID storage strategy
---------------------
SQLAlchemy 2.0's `Uuid` type (sqlalchemy.types.Uuid) stores natively
as UUID on PostgreSQL and falls back to VARCHAR(36) on SQLite.  This
gives zero-cost portability between the two databases.  All FK columns
that reference a UUID PK are declared as `Uuid` as well.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import Uuid


# ---------------------------------------------------------------------------
# Shared base — all models must inherit from this
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    """Project-wide declarative base.  Alembic's env.py imports
    Base.metadata to autogenerate migrations."""
    pass


# ---------------------------------------------------------------------------
# Common mixin applied to every entity
# ---------------------------------------------------------------------------

class EntityMixin:
    """
    Provides four columns that every entity in the schema must carry:

      id          — UUID primary key, auto-generated on insert.
      created_at  — UTC timestamp set once at row creation.
      updated_at  — UTC timestamp updated on every write.
      owner_id    — FK to users.id.  Dormant in phase 1 (nullable so the
                    app works without auth), enforced via application-level
                    middleware in phase 2.

    Usage::

        class Wafer(EntityMixin, Base):
            __tablename__ = "wafers"
            ...
    """

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        doc="UUID primary key, auto-generated.",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        doc="UTC timestamp of row creation.",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
        doc="UTC timestamp of last update.",
    )

    # owner_id is nullable in phase 1 (single-user, no auth).
    # In phase 2 it becomes non-nullable with a NOT NULL migration step.
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="FK to the User who owns this record. Nullable in phase 1.",
    )
