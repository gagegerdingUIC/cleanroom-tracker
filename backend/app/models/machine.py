"""
machine.py — Machine, MachineParameterDefinition, StepParameterValue.

The parameter system is the core of structured data capture.

MachineParameterDefinition
    Defined once per machine.  Drives the UI form: when a user selects
    a machine for a step, the frontend fetches that machine's parameter
    definitions and renders the appropriate input fields (with types,
    units, validation bounds, and defaults pre-populated).

StepParameterValue
    A row per parameter per step (or per run, for run-level shared data).
    Values are always stored as strings (value_raw) for lossless
    persistence, with a parsed numeric column (value_numeric) for
    querying and charting.

    A StepParameterValue can reference a MachineParameterDefinition
    (param_def_id is set) for structured entries, or be ad-hoc
    (param_def_id is null, param_name typed manually) for one-off
    parameters not in the definition set.

    Exactly one of step_id or run_id must be non-null per row.  This
    constraint is enforced in application logic (not a DB CHECK
    constraint, for SQLite compatibility).
"""

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from .base import Base, EntityMixin

if TYPE_CHECKING:
    from .process import ProcessRun, ProcessStep


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class MachineCategory(str, enum.Enum):
    characterization = "characterization"
    deposition = "deposition"
    etching = "etching"
    lithography = "lithography"
    packaging = "packaging"
    miscellaneous = "miscellaneous"


class ParamType(str, enum.Enum):
    input = "input"         # Set-point the user controls before the run
    output = "output"       # Read-back from the machine after the run
    measured = "measured"   # Value derived from a separate measurement step


class ParamDataType(str, enum.Enum):
    float_ = "float"
    integer = "integer"
    string = "string"
    boolean = "boolean"


# ---------------------------------------------------------------------------
# Machine
# ---------------------------------------------------------------------------

class Machine(EntityMixin, Base):
    """
    A physical piece of equipment in the cleanroom.

    Each machine has a set of MachineParameterDefinitions that describe
    what parameters to log when it is used.  Adding a new machine to the
    app requires only inserting Machine + Definition rows — no code changes.
    """

    __tablename__ = "machines"

    name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        doc="Full equipment name, e.g. 'Oxford PlasmaLab 100 ICP RIE'.",
    )

    category: Mapped[MachineCategory] = mapped_column(
        String(30),
        nullable=False,
        doc="Primary process category this machine is used for.",
    )

    abbreviation: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        doc="Short UI label, e.g. 'RIE-1', 'P7', 'DWL'.",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        doc="Whether this machine is currently available in the lab.",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="Calibration notes, known quirks, maintenance history, etc.",
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    parameter_definitions: Mapped[list["MachineParameterDefinition"]] = relationship(
        "MachineParameterDefinition",
        back_populates="machine",
        cascade="all, delete-orphan",
        order_by="MachineParameterDefinition.sort_order",
        doc="Ordered list of parameter definitions for this machine.",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Machine id={self.id} name={self.name!r} abbr={self.abbreviation!r}>"


# ---------------------------------------------------------------------------
# MachineParameterDefinition
# ---------------------------------------------------------------------------

class MachineParameterDefinition(EntityMixin, Base):
    """
    Defines one expected parameter for a specific machine.

    The full set of definitions for a machine is the 'schema' for that
    machine's step form.  When a user selects machine X for a step, the
    UI fetches these definitions and renders the form automatically.

    sort_order controls display sequence.  param_type distinguishes
    set-points (input) from instrument readbacks (output) from values
    obtained via a separate measurement step (measured).
    """

    __tablename__ = "machine_parameter_definitions"

    machine_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="The machine this parameter definition belongs to.",
    )

    name: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        doc="Snake-case identifier, e.g. 'rf_power_w', 'ar_flow_sccm'.",
    )

    display_name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        doc="Human label shown in the UI, e.g. 'RF Power (W)', 'Argon Flow (sccm)'.",
    )

    param_type: Mapped[ParamType] = mapped_column(
        String(20),
        nullable=False,
        doc="input = set-point, output = readback, measured = from separate step.",
    )

    data_type: Mapped[ParamDataType] = mapped_column(
        String(20),
        nullable=False,
        default=ParamDataType.float_,
        doc="Expected value type for UI rendering and validation.",
    )

    unit: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
        doc="Unit label, e.g. 'W', 'sccm', 'mTorr', 'nm/min'.  Null for dimensionless.",
    )

    is_required: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        doc="Whether the UI must require this field before the step can be saved.",
    )

    default_value: Mapped[str | None] = mapped_column(
        String(256),
        nullable=True,
        doc="Serialized default value (as string).  Pre-fills the UI field.",
    )

    min_value: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        doc="Minimum allowed numeric value for validation.",
    )

    max_value: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        doc="Maximum allowed numeric value for validation.",
    )

    sort_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        doc="Display order in the UI form.  Lower = appears first.",
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    machine: Mapped["Machine"] = relationship(
        "Machine",
        back_populates="parameter_definitions",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<MachineParamDef id={self.id} "
            f"machine_id={self.machine_id} name={self.name!r}>"
        )


# ---------------------------------------------------------------------------
# StepParameterValue
# ---------------------------------------------------------------------------

class StepParameterValue(EntityMixin, Base):
    """
    A single recorded parameter value for a process step or run.

    Polymorphic attachment:
      - step_id set, run_id null  → step-level value
      - run_id set, step_id null  → run-level value (shared across all
                                    wafers in the batch)

    Structured vs. ad-hoc:
      - param_def_id set  → value conforms to a MachineParameterDefinition
      - param_def_id null → ad-hoc entry; param_name is typed manually

    Storage:
      value_raw stores the value as a string always (preserves original
      precision and handles boolean/string types).  value_numeric is the
      parsed float for indexed querying.
    """

    __tablename__ = "step_parameter_values"

    # ------------------------------------------------------------------
    # Parent reference (one of these is non-null)
    # ------------------------------------------------------------------

    step_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("process_steps.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        doc="Parent step.  Null if this is a run-level value.",
    )

    run_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("process_runs.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        doc="Parent run.  Null if this is a step-level value.",
    )

    # ------------------------------------------------------------------
    # Parameter identity
    # ------------------------------------------------------------------

    param_def_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("machine_parameter_definitions.id", ondelete="SET NULL"),
        nullable=True,
        doc="Linked definition.  Null for ad-hoc entries not in the definition set.",
    )

    param_name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        doc=(
            "Parameter name, copied from the definition on save (or typed "
            "manually for ad-hoc entries).  Stored so the value remains "
            "readable even if the definition is later edited or deleted."
        ),
    )

    # ------------------------------------------------------------------
    # Value
    # ------------------------------------------------------------------

    value_raw: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        doc="Value always stored as string for lossless persistence.",
    )

    value_numeric: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        index=True,
        doc="Parsed float for range queries and charting.  Null for non-numeric types.",
    )

    unit: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
        doc="Unit, copied from the definition on save or typed manually.",
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    step: Mapped["ProcessStep | None"] = relationship(
        "ProcessStep",
        foreign_keys=[step_id],
        back_populates="parameter_values",
    )

    run: Mapped["ProcessRun | None"] = relationship(
        "ProcessRun",
        foreign_keys=[run_id],
        back_populates="parameter_values",
    )

    param_def: Mapped["MachineParameterDefinition | None"] = relationship(
        "MachineParameterDefinition",
        doc="The definition this value was recorded against, if structured.",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<StepParamValue id={self.id} "
            f"param={self.param_name!r} value={self.value_raw!r}>"
        )
