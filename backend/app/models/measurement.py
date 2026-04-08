"""
measurement.py — Measurement and MeasurementPoint.

A Measurement is a characterisation event linked to a process step
(e.g. a profilometer scan taken immediately after an etch step).

MeasurementPoint rows are the individual spatial data points within a
measurement.  The user places measurement point locations by clicking
on the wafer diagram in the UI; each click creates one row.

Single-point vs. multi-point:
    Single-point measurement  →  one MeasurementPoint row (x=0, y=0
                                 for centre, or wherever clicked).
    Multi-point measurement   →  N MeasurementPoint rows, each with
                                 its own (x, y) and measured value.

The separation between Measurement (metadata/intent) and
MeasurementPoint (spatial data) is intentional:
    - The Measurement records the instrument, date, and intended value
      (design target) so you can immediately compare target vs. actual.
    - MeasurementPoints carry the spatial coordinates and values for
      the data visualisation layer (heat map, contour plot, etc.).

Instrument field note (flagged in SCHEMA_NOTES.md):
    `instrument` is currently a free-text string ('P7 Profilometer',
    'Optical Profiler').  If you want the UI to offer a dropdown of
    your characterisation machines, change this to a FK to Machine.
    Kept as a string in the initial schema to avoid requiring a Machine
    row for every characterisation tool and to match how you naturally
    write it in your lab notebook.
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


class MeasurementType(str, enum.Enum):
    step_height = "step_height"         # Height difference at a step edge
    resist_depth = "resist_depth"       # Photoresist thickness post-develop
    etch_depth = "etch_depth"           # Material removed by etch
    feature_length = "feature_length"   # Lateral feature dimension (linewidth check)
    film_thickness = "film_thickness"   # Deposited film thickness
    other = "other"


class Measurement(EntityMixin, Base):
    """
    A characterisation measurement event linked to a process step.

    Records intent (what was being measured, with what tool, targeting
    what value) and provides the parent context for MeasurementPoints.
    """

    __tablename__ = "measurements"

    step_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("process_steps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="The process step this measurement characterises.",
    )

    measurement_type: Mapped[MeasurementType] = mapped_column(
        String(30),
        nullable=False,
        doc="What physical quantity is being measured.",
    )

    instrument: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        doc=(
            "The instrument used, e.g. 'P7 Profilometer', 'Optical Profiler', "
            "'Ellipsometer', 'SEM'.  Free-text for flexibility; see SCHEMA_NOTES.md "
            "for the FK-to-Machine upgrade path."
        ),
    )

    intended_value: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        doc=(
            "Target / design value for this measurement (e.g. desired etch depth "
            "or resist thickness).  Enables immediate target-vs-actual comparison."
        ),
    )

    unit: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        doc="Unit for both intended_value and all MeasurementPoint values, e.g. 'nm', 'µm'.",
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
        back_populates="measurements",
    )

    points: Mapped[list["MeasurementPoint"]] = relationship(
        "MeasurementPoint",
        back_populates="measurement",
        cascade="all, delete-orphan",
        doc="Individual spatial data points collected during this measurement.",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<Measurement id={self.id} type={self.measurement_type} "
            f"instrument={self.instrument!r}>"
        )


class MeasurementPoint(EntityMixin, Base):
    """
    A single (x, y, value) data point within a Measurement.

    Coordinates are stored in microns from the wafer centre (consistent
    with the wafer_mm coordinate space on Region, scaled to µm for
    sub-millimetre precision typical of profilometer measurements).

    The user places points by clicking on the wafer diagram in the UI.
    The frontend sends (x_um, y_um) computed from the click position
    relative to the known wafer diameter.
    """

    __tablename__ = "measurement_points"

    measurement_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("measurements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="The parent measurement event.",
    )

    x_um: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        doc="X coordinate in micrometres from wafer centre (positive = right).",
    )

    y_um: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        doc="Y coordinate in micrometres from wafer centre (positive = up, flat = −Y).",
    )

    p7_x: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        doc="Raw P7 profiler X coordinate in µm (before calibration transform).",
    )

    p7_y: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        doc="Raw P7 profiler Y coordinate in µm (before calibration transform).",
    )

    value: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        doc="Measured value at this location, in the unit specified on Measurement.",
    )

    upper_material: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        doc="Material on the high side of the step (e.g. 'Metal', 'Resist').",
    )

    lower_material: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        doc="Material on the low side of the step (e.g. 'Substrate', 'Oxide').",
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    measurement: Mapped["Measurement"] = relationship(
        "Measurement",
        back_populates="points",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<MeasurementPoint id={self.id} "
            f"x={self.x_um}µm y={self.y_um}µm value={self.value}>"
        )
