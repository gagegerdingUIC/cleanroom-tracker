"""
process.py — ProcessStep, ProcessEdge, and ProcessRun.

ProcessStep is the central entity of the application.  Steps form a
directed acyclic graph (DAG) — though in practice it can have cycles
for repeated operations — via the ProcessEdge join table.

Single-table design decision
-----------------------------
A single `ProcessStep` table is used rather than per-category
subclasses (DepositionStep, EtchStep, etc.).  Category-specific data
is stored as StepParameterValues (key-value rows) driven by
MachineParameterDefinitions.  The one structural exception is etching,
which carries an optional FK to an EtchRecipe.  See STRUCTURE.md for
the full rationale.

ProcessRun groups multiple wafers that went through the same equipment
run simultaneously.  Run-level parameters and attachments live on the
run; individual wafer steps reference it via run_id.
"""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from .base import Base, EntityMixin

if TYPE_CHECKING:
    from .attachment import DataAttachment
    from .layer import LayerDescriptor
    from .machine import Machine, StepParameterValue
    from .measurement import Measurement
    from .recipe import EtchRecipe
    from .region import Region
    from .timelog import TimeLog
    from .wafer import Wafer


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class StepCategory(str, enum.Enum):
    characterization = "characterization"
    deposition = "deposition"
    etching = "etching"
    lithography = "lithography"
    packaging = "packaging"
    miscellaneous = "miscellaneous"


class StepStatus(str, enum.Enum):
    planned = "planned"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"
    skipped = "skipped"


# ---------------------------------------------------------------------------
# ProcessRun
# ---------------------------------------------------------------------------

class ProcessRun(EntityMixin, Base):
    """
    Groups multiple wafers that were processed together in the same
    machine run (e.g. a single PECVD run processing 3 wafers side by
    side).  Run-level parameters and attachments are stored here and
    shared across all linked wafer steps.

    Individual ProcessSteps link to their run via `run_id` (nullable).
    A step with run_id=None was performed independently.
    """

    __tablename__ = "process_runs"

    run_label: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        doc="Human label, e.g. 'PECVD-2026-03-01-A'.  Unique per owner recommended.",
    )

    machine_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("machines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="Primary machine used for this run.",
    )

    category: Mapped[StepCategory] = mapped_column(
        String(30),
        nullable=False,
        doc="Process category — mirrors the categories on ProcessStep.",
    )

    timestamp_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        doc="When the run began.",
    )

    timestamp_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="When the run ended.  Null if still in progress.",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    machine: Mapped["Machine | None"] = relationship(
        "Machine",
        foreign_keys=[machine_id],
        doc="The machine used for this batch run.",
    )

    steps: Mapped[list["ProcessStep"]] = relationship(
        "ProcessStep",
        back_populates="run",
        doc="All individual wafer steps that are part of this run.",
    )

    parameter_values: Mapped[list["StepParameterValue"]] = relationship(
        "StepParameterValue",
        primaryjoin="StepParameterValue.run_id == ProcessRun.id",
        foreign_keys="StepParameterValue.run_id",
        back_populates="run",
        cascade="all, delete-orphan",
        doc="Run-level parameter values (shared across all wafers in the run).",
    )

    attachments: Mapped[list["DataAttachment"]] = relationship(
        "DataAttachment",
        primaryjoin="DataAttachment.run_id == ProcessRun.id",
        foreign_keys="DataAttachment.run_id",
        back_populates="run",
        cascade="all, delete-orphan",
        doc="Files attached at the run level (e.g. machine log for the whole run).",
    )

    time_logs: Mapped[list["TimeLog"]] = relationship(
        "TimeLog",
        back_populates="run",
        doc="Machine-time billing records for this run (dormant in phase 1).",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ProcessRun id={self.id} label={self.run_label!r}>"


# ---------------------------------------------------------------------------
# ProcessStep
# ---------------------------------------------------------------------------

class ProcessStep(EntityMixin, Base):
    """
    A single discrete operation applied to a wafer.

    Steps are connected via ProcessEdge to form a directed graph.
    step_number is a display hint only — the graph structure is
    authoritative for the process sequence.

    Category-specific data (gas flows, spin speed, etc.) is stored in
    StepParameterValue rows.  Etch steps additionally carry an optional
    FK to an EtchRecipe.
    """

    __tablename__ = "process_steps"

    # ------------------------------------------------------------------
    # Core identity
    # ------------------------------------------------------------------

    wafer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("wafers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="The wafer this step was performed on.",
    )

    step_number: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        doc=(
            "Display-order hint.  Not authoritative — the ProcessEdge graph "
            "determines the true sequence.  Useful for simple linear runs."
        ),
    )

    category: Mapped[StepCategory] = mapped_column(
        String(30),
        nullable=False,
        index=True,
        doc="Process category.  Drives UI form and parameter set selection.",
    )

    name: Mapped[str] = mapped_column(
        String(256),
        nullable=False,
        doc="Short human label, e.g. 'Nb RF sputtering', 'AZ1518 spin coat'.",
    )

    # ------------------------------------------------------------------
    # Timing
    # ------------------------------------------------------------------

    timestamp_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        doc="When the step began.",
    )

    timestamp_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="When the step ended.  Null while still in progress.",
    )

    # ------------------------------------------------------------------
    # Machine and spatial context
    # ------------------------------------------------------------------

    machine_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("machines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="Primary machine used.  Null for manual or equipment-free steps.",
    )

    region_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("regions.id", ondelete="SET NULL"),
        nullable=True,
        doc=(
            "Spatial region this step acted on.  Null = whole wafer. "
            "A lithography step typically creates a new Region and links to it."
        ),
    )

    # ------------------------------------------------------------------
    # Batch run membership
    # ------------------------------------------------------------------

    run_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("process_runs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="The batch run this step belongs to.  Null if run independently.",
    )

    # ------------------------------------------------------------------
    # Etch recipe (etching category only)
    # ------------------------------------------------------------------

    etch_recipe_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("etch_recipes.id", ondelete="SET NULL"),
        nullable=True,
        doc=(
            "The EtchRecipe used for this step.  Only populated when "
            "category == 'etching'.  Supports both saved library recipes and "
            "one-off recipes (EtchRecipe.is_template == False)."
        ),
    )

    # ------------------------------------------------------------------
    # Status and quality flags
    # ------------------------------------------------------------------

    status: Mapped[StepStatus] = mapped_column(
        String(20),
        nullable=False,
        default=StepStatus.planned,
        doc="Lifecycle status of this step.",
    )

    is_anomalous: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        doc="Flag for unusual or suspect results.  Shown visually in the graph.",
    )

    anomaly_note: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="Description of the anomaly when is_anomalous=True.",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="General notes for this step.",
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    wafer: Mapped["Wafer"] = relationship(
        "Wafer",
        back_populates="process_steps",
    )

    machine: Mapped["Machine | None"] = relationship(
        "Machine",
        foreign_keys=[machine_id],
    )

    region: Mapped["Region | None"] = relationship(
        "Region",
        foreign_keys=[region_id],
    )

    run: Mapped["ProcessRun | None"] = relationship(
        "ProcessRun",
        back_populates="steps",
    )

    etch_recipe: Mapped["EtchRecipe | None"] = relationship(
        "EtchRecipe",
        back_populates="steps",
    )

    # Outgoing edges (steps that come AFTER this one)
    outgoing_edges: Mapped[list["ProcessEdge"]] = relationship(
        "ProcessEdge",
        foreign_keys="ProcessEdge.from_step_id",
        back_populates="from_step",
        cascade="all, delete-orphan",
        doc="Edges leaving this step (this step → successor).",
    )

    # Incoming edges (steps that came BEFORE this one)
    incoming_edges: Mapped[list["ProcessEdge"]] = relationship(
        "ProcessEdge",
        foreign_keys="ProcessEdge.to_step_id",
        back_populates="to_step",
        cascade="all, delete-orphan",
        doc="Edges arriving at this step (predecessor → this step).",
    )

    parameter_values: Mapped[list["StepParameterValue"]] = relationship(
        "StepParameterValue",
        primaryjoin="StepParameterValue.step_id == ProcessStep.id",
        foreign_keys="StepParameterValue.step_id",
        back_populates="step",
        cascade="all, delete-orphan",
        doc="All parameter values recorded for this step.",
    )

    attachments: Mapped[list["DataAttachment"]] = relationship(
        "DataAttachment",
        primaryjoin="DataAttachment.step_id == ProcessStep.id",
        foreign_keys="DataAttachment.step_id",
        back_populates="step",
        cascade="all, delete-orphan",
    )

    measurements: Mapped[list["Measurement"]] = relationship(
        "Measurement",
        back_populates="step",
        cascade="all, delete-orphan",
        doc="Spatial measurements taken as part of or after this step.",
    )

    layer_descriptors: Mapped[list["LayerDescriptor"]] = relationship(
        "LayerDescriptor",
        back_populates="step",
        cascade="all, delete-orphan",
        doc=(
            "Physical layer state records after this step.  "
            "Optional enrichment; foundation for the phase 3 3D viewer."
        ),
    )

    time_logs: Mapped[list["TimeLog"]] = relationship(
        "TimeLog",
        back_populates="step",
        doc="Machine-time billing records for this step (dormant in phase 1).",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<ProcessStep id={self.id} name={self.name!r} "
            f"category={self.category} status={self.status}>"
        )


# ---------------------------------------------------------------------------
# ProcessEdge
# ---------------------------------------------------------------------------

class ProcessEdge(Base):
    """
    Directed edge in the process graph.  An edge from step A to step B
    means B was performed after A.

    ProcessEdge does NOT inherit EntityMixin because it is a pure join
    entity with no independent lifecycle; it carries no owner or
    timestamps of its own.  The graph is owned by the steps it connects.

    Uniqueness: only one edge per (from, to) pair is allowed.  Multiple
    paths (branches) are represented by multiple edges from the same
    source step to different targets.
    """

    __tablename__ = "process_edges"

    __table_args__ = (
        UniqueConstraint("from_step_id", "to_step_id", name="uq_process_edge"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )

    from_step_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("process_steps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="The predecessor step.",
    )

    to_step_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("process_steps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="The successor step.",
    )

    edge_note: Mapped[str | None] = mapped_column(
        String(256),
        nullable=True,
        doc=(
            "Optional label describing the transition, e.g. "
            "'after inspection: passed', 'etch loop iteration 2'."
        ),
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    from_step: Mapped["ProcessStep"] = relationship(
        "ProcessStep",
        foreign_keys=[from_step_id],
        back_populates="outgoing_edges",
    )

    to_step: Mapped["ProcessStep"] = relationship(
        "ProcessStep",
        foreign_keys=[to_step_id],
        back_populates="incoming_edges",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ProcessEdge {self.from_step_id} → {self.to_step_id}>"
