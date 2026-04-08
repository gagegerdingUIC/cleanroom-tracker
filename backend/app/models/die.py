"""
die.py — Die entity.

STATUS: DORMANT — No API endpoints or CRUD layer exist for this model.
Kept because DataAttachment.die_id FK depends on the dies table.

A die is a named spatial subregion of a wafer, typically defined after
dicing.  Its process history is not stored explicitly; it is computed
on demand by the die history query:

    SELECT step.*
    FROM process_steps step
    JOIN regions step_region ON step.region_id = step_region.id
    WHERE step.wafer_id = :wafer_id
      AND (
          step_region.region_type = 'whole_wafer'          -- always included
          OR spatial_overlap(step_region.geometry_json,
                             die_region.geometry_json)      -- intersects die
      )

This avoids redundant storage and stays automatically correct if a
region's geometry is edited after the fact.

The spatial overlap logic is currently application-level Python using
Shapely.  In phase 2 (PostgreSQL), it can be migrated to PostGIS for
indexed spatial queries if performance requires it.
"""

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from .base import Base, EntityMixin

if TYPE_CHECKING:
    from .attachment import DataAttachment
    from .region import Region
    from .wafer import Wafer


class DieStatus(str, enum.Enum):
    intact = "intact"
    packaged = "packaged"
    tested = "tested"
    destroyed = "destroyed"


class Die(EntityMixin, Base):
    """
    A named spatial subregion of a wafer, defined at or after dicing.

    row / col are provided for regular grid dicing layouts.  For
    irregular cuts, set both to null and rely on die_label + region_id
    for identification.
    """

    __tablename__ = "dies"

    wafer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("wafers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="The parent wafer.",
    )

    die_label: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        doc="Human label for this die, e.g. 'A1', 'B3', 'centre-chip'.",
    )

    region_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("regions.id", ondelete="RESTRICT"),
        nullable=False,
        doc=(
            "FK to the Region that defines this die's spatial extent.  "
            "Used by the history query to find overlapping process steps."
        ),
    )

    row: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        doc="Grid row index for regular dicing layouts.  Null for irregular cuts.",
    )

    col: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        doc="Grid column index for regular dicing layouts.  Null for irregular cuts.",
    )

    status: Mapped[DieStatus] = mapped_column(
        String(20),
        nullable=False,
        default=DieStatus.intact,
        doc="Current lifecycle status of this die.",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    wafer: Mapped["Wafer"] = relationship(
        "Wafer",
        back_populates="dies",
    )

    region: Mapped["Region"] = relationship(
        "Region",
        doc="The Region defining the spatial extent of this die.",
    )

    attachments: Mapped[list["DataAttachment"]] = relationship(
        "DataAttachment",
        primaryjoin="DataAttachment.die_id == Die.id",
        foreign_keys="DataAttachment.die_id",
        back_populates="die",
        cascade="all, delete-orphan",
        doc="Files attached specifically to this die (e.g. post-package SEM).",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Die id={self.id} label={self.die_label!r} status={self.status}>"
