"""
region.py — Region (spatial descriptors and reusable masks).

STATUS: No dedicated API endpoints. Used as FK target by ProcessStep.region_id,
Die.region_id, and LayerDescriptor.region_id.

Regions are first-class entities.  A lithography step creates a named
Region (the photomask); a subsequent etch step references that region
(or its inverse) as its acting area.

Geometry is stored as JSON in a single `geometry_json` column rather
than normalised columns per geometry type.  The `region_type` enum
tells the reader how to interpret the JSON.  This design lets the
schema evolve from simple 2D polygons to 3D meshes without a migration.

Geometry JSON schemas by type
------------------------------
  polygon         : [{"x": float, "y": float}, ...]
  circle          : {"cx": float, "cy": float, "r": float}
  rectangle       : {"x": float, "y": float, "w": float, "h": float}
  photomask_*     : same as polygon (the mask boundary)
  kapton          : same as polygon or rectangle (tape boundaries)
  whole_wafer     : null (the entire substrate)
  custom_coords   : [{"x": float, "y": float}, ...]  (arbitrary closed polygon)
  mesh_3d         : {"uri": str}  (reference to 3D geometry file in storage)

All coordinates are in the coordinate_space declared on the region.
The default is wafer_mm (millimetres from wafer centre, flat/notch
pointing in the −Y direction).
"""

import enum
import uuid
from typing import Any, TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from .base import Base, EntityMixin

if TYPE_CHECKING:
    from .wafer import Wafer


class RegionType(str, enum.Enum):
    whole_wafer = "whole_wafer"
    polygon = "polygon"
    circle = "circle"
    rectangle = "rectangle"
    photomask_positive = "photomask_positive"   # Exposed (lit) areas
    photomask_negative = "photomask_negative"   # Unexposed (dark) areas
    kapton = "kapton"                           # Kapton tape coverage
    custom_coords = "custom_coords"
    mesh_3d = "mesh_3d"


class CoordinateSpace(str, enum.Enum):
    wafer_mm = "wafer_mm"       # Millimetres from wafer centre
    normalized = "normalized"   # 0-to-1 relative to wafer diameter
    pixel = "pixel"             # Raw pixel coordinates (from image import)


class Region(EntityMixin, Base):
    """
    A named spatial region on a wafer.

    Regions are reusable: once a lithography step creates 'Mask A', an
    etch step can reference it by ID.  Inverse masks are expressed as a
    new Region with is_inverse=True and source_mask_id pointing to the
    original.  The frontend infers the inverse geometry at render time
    using the wafer diameter.
    """

    __tablename__ = "regions"

    wafer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("wafers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="The wafer this region is defined on.",
    )

    name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        doc="Human label, e.g. 'Mask A', 'Kapton tape area', 'Top half'.",
    )

    region_type: Mapped[RegionType] = mapped_column(
        String(30),
        nullable=False,
        doc="Geometry type.  Tells the reader how to parse geometry_json.",
    )

    # ------------------------------------------------------------------
    # Derived / inverse regions
    # ------------------------------------------------------------------

    source_mask_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("regions.id", ondelete="SET NULL"),
        nullable=True,
        doc=(
            "If this region is derived from another (e.g. the inverse of "
            "a photomask), FK to the parent Region."
        ),
    )

    is_inverse: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        doc=(
            "True if this region is the complement of source_mask. "
            "The geometry_json stores the source boundary; inversion is "
            "computed at render time using the wafer diameter."
        ),
    )

    # ------------------------------------------------------------------
    # Geometry
    # ------------------------------------------------------------------

    geometry_json: Mapped[Any | None] = mapped_column(
        JSON,
        nullable=True,
        doc=(
            "Serialized geometry. Format depends on region_type. "
            "Null for whole_wafer (no geometry needed)."
        ),
    )

    coordinate_space: Mapped[CoordinateSpace] = mapped_column(
        String(20),
        nullable=False,
        default=CoordinateSpace.wafer_mm,
        doc=(
            "Coordinate reference frame.  wafer_mm is preferred: "
            "millimetres from wafer centre, flat pointing −Y."
        ),
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
        back_populates="regions",
    )

    source_mask: Mapped["Region | None"] = relationship(
        "Region",
        remote_side="Region.id",
        foreign_keys=[source_mask_id],
        doc="The parent region this one is derived from.",
    )

    derived_regions: Mapped[list["Region"]] = relationship(
        "Region",
        foreign_keys=[source_mask_id],
        back_populates="source_mask",
        doc="Regions derived from this one (e.g. its inverse).",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<Region id={self.id} name={self.name!r} "
            f"type={self.region_type} inverse={self.is_inverse}>"
        )
