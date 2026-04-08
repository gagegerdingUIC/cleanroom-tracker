"""
user.py — User entity.

Dormant in phase 1 (single-user, no authentication enforced).
The table is created from day one so that:
  - owner_id FKs on all other entities are valid from the start.
  - Phase 2 JWT auth activation requires zero schema migrations.

A single seed row (the local researcher) is inserted by the seed script
so that owner_id can be populated even in phase 1.
"""

import enum

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, EntityMixin


class UserRole(str, enum.Enum):
    admin = "admin"
    researcher = "researcher"
    viewer = "viewer"


class User(EntityMixin, Base):
    """
    Application user.  In phase 1, exactly one row exists (the local
    researcher).  In phase 2, multi-user auth is activated and every
    request is scoped to the authenticated user's owner_id.
    """

    __tablename__ = "users"

    username: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
        doc="Unique login handle, e.g. 'gage'.",
    )

    email: Mapped[str] = mapped_column(
        String(254),
        unique=True,
        nullable=False,
        doc="Email address for notifications and LIMS billing reports.",
    )

    hashed_password: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        doc="bcrypt hash of the user's password.  Never store plaintext.",
    )

    role: Mapped[UserRole] = mapped_column(
        String(20),
        nullable=False,
        default=UserRole.researcher,
        doc="Access tier: admin, researcher, or viewer.",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        doc="Soft-disable a user without deleting their data.",
    )

    # Note: owner_id on User itself is intentionally left as-is from the mixin
    # (nullable, points to users.id).  In practice it will be NULL for the
    # single-user phase-1 setup and self-referential for admin users in phase 2.
    # A dedicated admin_created_by_id column can be added in phase 2 if needed.

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User id={self.id} username={self.username!r} role={self.role}>"
