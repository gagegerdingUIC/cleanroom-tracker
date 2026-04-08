"""
carrier.py — Wafer carrier (cassette) entity.

A Carrier represents a physical wafer cassette with a fixed number of
numbered slots.  Each slot can hold one wafer of the carrier's specified
diameter.  Wafers reference their carrier via carrier_id + slot_number
on the Wafer model.
"""

from typing import TYPE_CHECKING

from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, EntityMixin

if TYPE_CHECKING:
    from .wafer import Wafer


class Carrier(EntityMixin, Base):
    __tablename__ = "carriers"

    name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        doc="User-defined carrier name, e.g. '2-inch Carrier A'.",
    )

    slot_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        doc="Number of slots in this carrier.",
    )

    wafer_diameter_mm: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        doc="Wafer diameter this carrier accepts, in millimetres.",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="Free-form notes about this carrier.",
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    wafers: Mapped[list["Wafer"]] = relationship(
        "Wafer",
        back_populates="carrier",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<Carrier id={self.id} name={self.name!r} "
            f"slots={self.slot_count} dia={self.wafer_diameter_mm}mm>"
        )
