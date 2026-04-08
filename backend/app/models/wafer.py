"""
wafer.py — Wafer entity.

The Wafer is the central physical substrate around which everything else
is organised.  A wafer persists as an entity even after dicing; its
dies (Die model) are defined once the wafer is cut.

wafer_id (the human-readable label, e.g. 'W-2026-001') is unique per
owner so different researchers can have overlapping ID series without
collision.  The UUID `id` from EntityMixin is the internal PK used for
all FK references.
"""

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from .base import Base, EntityMixin

if TYPE_CHECKING:
    from .carrier import Carrier
    from .die import Die
    from .folder import WaferFolder
    from .process import ProcessStep
    from .region import Region


class WaferShape(str, enum.Enum):
    circular = "circular"
    square = "square"
    rectangular = "rectangular"
    custom = "custom"


class DopingType(str, enum.Enum):
    p = "p"
    n = "n"
    undoped = "undoped"
    semi_insulating = "semi-insulating"


class WaferStatus(str, enum.Enum):
    active = "active"
    recycled = "recycled"
    diced = "diced"
    archived = "archived"
    destroyed = "destroyed"


class Wafer(EntityMixin, Base):
    """
    A physical substrate.  Carries material properties, provenance, and
    current status.  Its process history is accessed via the
    `process_steps` relationship (directed graph via ProcessEdge).
    """

    __tablename__ = "wafers"

    # Enforce uniqueness of the human label per owner.
    # In phase 1 (single user), owner_id is always the same seed user.
    __table_args__ = (
        UniqueConstraint("wafer_id", "owner_id", name="uq_wafer_id_per_owner"),
        UniqueConstraint("carrier_id", "slot_number", name="uq_carrier_slot"),
    )

    # ------------------------------------------------------------------
    # Identity
    # ------------------------------------------------------------------

    wafer_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        doc="Human-readable label, e.g. 'W-2026-001'.  Unique per owner.",
    )

    # ------------------------------------------------------------------
    # Material properties
    # ------------------------------------------------------------------

    material: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        doc="Substrate material, e.g. 'Si', 'GaAs', 'InP', 'SiC'.",
    )

    diameter_mm: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        doc="Wafer diameter in millimetres (e.g. 51, 76, 100).",
    )

    shape: Mapped[WaferShape] = mapped_column(
        String(20),
        nullable=False,
        default=WaferShape.circular,
        doc="Physical shape of the substrate.",
    )

    doping_type: Mapped[DopingType] = mapped_column(
        String(20),
        nullable=False,
        doc="Doping type: p, n, undoped, or semi-insulating.",
    )

    doping_level: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        doc="Carrier concentration in cm⁻³.  Null for undoped/semi-insulating.",
    )

    resistivity_ohm_cm: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        doc="Sheet resistivity in Ω·cm.  Often more useful than doping level.",
    )

    crystal_orientation: Mapped[str | None] = mapped_column(
        String(16),
        nullable=True,
        doc="Miller index notation, e.g. '(100)', '(111)', '(110)'.",
    )

    # ------------------------------------------------------------------
    # Provenance
    # ------------------------------------------------------------------

    vendor: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
        doc="Supplier name, e.g. 'Virginia Semiconductor'.",
    )

    lot_number: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        doc="Vendor lot or batch identifier for traceability.",
    )

    # ------------------------------------------------------------------
    # Status and notes
    # ------------------------------------------------------------------

    status: Mapped[WaferStatus] = mapped_column(
        String(20),
        nullable=False,
        default=WaferStatus.active,
        doc="Current lifecycle status.",
    )

    is_recycled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        doc="Whether this wafer was recycled from a previous wafer.",
    )

    recycled_from_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("wafers.id", ondelete="SET NULL"),
        nullable=True,
        doc="The previous wafer this was recycled from, if applicable.",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="Free-form notes, e.g. surface quality observations at receipt.",
    )

    thumbnail_path: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
        doc="Path to an initial wafer photo in file storage.",
    )

    # ------------------------------------------------------------------
    # Organisation
    # ------------------------------------------------------------------

    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("wafer_folders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="Optional folder for organising wafers into projects.",
    )

    carrier_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("carriers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="Carrier (cassette) this wafer currently sits in.",
    )

    slot_number: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        doc="Slot position within the carrier (1-based).",
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    folder: Mapped["WaferFolder | None"] = relationship(
        "WaferFolder",
        back_populates="wafers",
    )

    carrier: Mapped["Carrier | None"] = relationship(
        "Carrier",
        back_populates="wafers",
    )

    recycled_from: Mapped["Wafer | None"] = relationship(
        "Wafer",
        remote_side="Wafer.id",
        foreign_keys=[recycled_from_id],
    )

    process_steps: Mapped[list["ProcessStep"]] = relationship(
        "ProcessStep",
        back_populates="wafer",
        cascade="all, delete-orphan",
        doc="All process steps applied to this wafer (unordered; use edges for graph).",
    )

    regions: Mapped[list["Region"]] = relationship(
        "Region",
        back_populates="wafer",
        cascade="all, delete-orphan",
        doc="All spatial regions defined on this wafer.",
    )

    dies: Mapped[list["Die"]] = relationship(
        "Die",
        back_populates="wafer",
        cascade="all, delete-orphan",
        doc="Dies defined on this wafer (populated at or after dicing).",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Wafer id={self.id} wafer_id={self.wafer_id!r} material={self.material!r}>"
