"""
layer.py — LayerDescriptor.

STATUS: DORMANT (Phase 3) — No API endpoints or CRUD layer exist yet.
Kept because ProcessStep.layer_descriptors relationship depends on it.

Foundation for the phase 3 3D layer viewer.  Records the physical state
of a layer on the wafer after each relevant process step.

This table is created in phase 1 but the data-entry UI is only built in
phase 3.  Users who want to start capturing layer data immediately can
populate it via the API or a future optional StepForm section.

Design rationale:
    Capturing this data retroactively after the 3D viewer is built is
    painful — it requires hunting through old lab notes.  Defining the
    schema now means early adopters can optionally fill it in from day
    one, and all historic data feeds the viewer without re-entry.

Multiple layers per step:
    A single process step can create or modify multiple layers
    (e.g. a deposition step adds a new layer, an etch step removes
    material from an existing one).  The relationship is one step →
    many LayerDescriptors, differentiated by layer_type and region_id.

Spatial scope:
    region_id links to the Region the layer applies to.  This allows
    partial-wafer depositions (e.g. only where the mask opens) to be
    accurately represented in the 3D viewer.
"""

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from .base import Base, EntityMixin

if TYPE_CHECKING:
    from .process import ProcessStep
    from .region import Region


class LayerType(str, enum.Enum):
    deposited = "deposited"
    etched = "etched"
    implanted = "implanted"
    oxidized = "oxidized"
    photoresist = "photoresist"


class ThicknessSource(str, enum.Enum):
    user_estimate = "user_estimate"
    measured_profilometer = "measured_profilometer"
    measured_ellipsometer = "measured_ellipsometer"
    measured_sem = "measured_sem"
    simulated = "simulated"


class EtchProfile(str, enum.Enum):
    anisotropic = "anisotropic"   # Vertical sidewalls (ideal RIE)
    isotropic = "isotropic"       # Rounded / lateral undercut
    tapered = "tapered"           # Angled sidewalls


class LayerDescriptor(EntityMixin, Base):
    """
    Physical layer state record after a process step.

    Deposited layers carry material and thickness.  Etched layers carry
    etch depth (as a negative thickness or via etch_depth convention),
    etch profile, and sidewall geometry parameters.  Photoresist layers
    carry resist thickness (from the Measurement system) and profile.

    All geometry fields are nullable: fill in what you know, leave the
    rest null.  The 3D viewer renders what is available and falls back
    to simplified representations for missing data.
    """

    __tablename__ = "layer_descriptors"

    step_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("process_steps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="The process step that created or modified this layer.",
    )

    layer_type: Mapped[LayerType] = mapped_column(
        String(30),
        nullable=False,
        doc="What happened to the layer at this step.",
    )

    material: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        doc=(
            "Material name, e.g. 'Nb', 'NbTi', 'AZ1518', 'SiO2', 'Si'.  "
            "Use the same convention consistently for the 3D viewer to "
            "render materials with the correct colour/style."
        ),
    )

    # ------------------------------------------------------------------
    # Thickness
    # ------------------------------------------------------------------

    thickness_nm: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        doc=(
            "Layer thickness in nanometres.  For etched layers this is the "
            "depth removed (positive value).  Null if unknown."
        ),
    )

    thickness_source: Mapped[ThicknessSource] = mapped_column(
        String(30),
        nullable=False,
        default=ThicknessSource.user_estimate,
        doc="How the thickness value was obtained, for confidence scoring.",
    )

    # ------------------------------------------------------------------
    # Etch profile geometry (null for non-etch steps)
    # ------------------------------------------------------------------

    etch_profile: Mapped[EtchProfile | None] = mapped_column(
        String(20),
        nullable=True,
        doc=(
            "Sidewall profile of an etched feature.  Null for deposition, "
            "implant, and oxidation steps."
        ),
    )

    sidewall_angle_deg: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        doc=(
            "Sidewall angle in degrees from vertical.  "
            "90° = perfectly vertical (ideal anisotropic etch).  "
            "<90° = tapered (sloped inward).  Null if not measured."
        ),
    )

    undercut_nm: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        doc=(
            "Lateral undercut in nanometres.  Non-zero for isotropic etch "
            "profiles.  Null if not measured or not applicable."
        ),
    )

    # ------------------------------------------------------------------
    # Spatial context
    # ------------------------------------------------------------------

    region_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("regions.id", ondelete="SET NULL"),
        nullable=True,
        doc=(
            "The Region this layer applies to.  Null = whole wafer.  "
            "For partial depositions or masked etches, this should match "
            "the region on the parent ProcessStep."
        ),
    )

    # ------------------------------------------------------------------
    # 3D geometry file (phase 3)
    # ------------------------------------------------------------------

    geometry_file_path: Mapped[str | None] = mapped_column(
        String(1024),
        nullable=True,
        doc=(
            "Path to a 3D mesh file if high-resolution geometry is available "
            "(e.g. from a profilometer surface scan imported as STL/PLY).  "
            "Null until the 3D geometry import feature is built in phase 3."
        ),
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    step: Mapped["ProcessStep"] = relationship(
        "ProcessStep",
        back_populates="layer_descriptors",
    )

    region: Mapped["Region | None"] = relationship(
        "Region",
        doc="The spatial region this layer descriptor applies to.",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<LayerDescriptor id={self.id} "
            f"step_id={self.step_id} material={self.material!r} "
            f"type={self.layer_type}>"
        )
