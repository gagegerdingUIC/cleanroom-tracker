"""
timelog.py — TimeLog.

Dormant in phase 1.  Present in the schema from day one to avoid a
future migration when LIMS billing is activated in phase 2.

When activated, TimeLogs are created automatically:
  - start_time is set when a step's status transitions to 'in_progress'
  - end_time is set when the step transitions to 'completed' or 'failed'
  - duration_minutes is computed on close: (end_time - start_time) in minutes

The billing_rate_id FK points to a BillingRate table that will be added
in phase 2.  The FK is declared here as a nullable string column (not a
real FK) so the schema is valid before the BillingRate table exists.
Once that table is created, the column type can be migrated to a proper
UUID FK without touching data.

For batch runs, the TimeLog is attached to the ProcessRun.  Individual
wafer steps that are part of the run do not need their own TimeLogs —
billing for the run is split evenly across participating wafers by
application logic.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from .base import Base, EntityMixin

if TYPE_CHECKING:
    from .machine import Machine
    from .process import ProcessRun, ProcessStep
    from .user import User


class TimeLog(EntityMixin, Base):
    """
    Machine-time billing record linking a user, machine, and process
    step or run.

    In phase 1: table exists but is never written.
    In phase 2: records are created automatically on step start/end.
    """

    __tablename__ = "time_logs"

    # ------------------------------------------------------------------
    # Who / what / when
    # ------------------------------------------------------------------

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="The researcher using the machine.",
    )

    machine_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="The machine being used.",
    )

    # ------------------------------------------------------------------
    # Parent context (one or both may be set)
    # ------------------------------------------------------------------

    run_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("process_runs.id", ondelete="SET NULL"),
        nullable=True,
        doc=(
            "The batch run this time log belongs to.  "
            "Set for runs; null for single-wafer steps."
        ),
    )

    step_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("process_steps.id", ondelete="SET NULL"),
        nullable=True,
        doc=(
            "The individual step this time log belongs to.  "
            "Null if the time log is at the run level."
        ),
    )

    # ------------------------------------------------------------------
    # Timing
    # ------------------------------------------------------------------

    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        doc="When the machine session began (step entered in_progress).",
    )

    end_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="When the machine session ended (step completed or failed).  Null if still running.",
    )

    duration_minutes: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        doc="Session duration in minutes.  Computed and stored when end_time is set.",
    )

    # ------------------------------------------------------------------
    # Billing
    # ------------------------------------------------------------------

    # Phase 1: stored as a plain nullable string so the column exists
    # without requiring the BillingRate table.
    # Phase 2: migrate to Uuid FK → billing_rates.id.
    billing_rate_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        doc=(
            "Placeholder FK to a future BillingRate row.  "
            "Stored as VARCHAR(36) in phase 1; upgrade to UUID FK in phase 2."
        ),
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user_id],
        doc="The researcher this time log belongs to.",
    )

    machine: Mapped["Machine"] = relationship(
        "Machine",
        foreign_keys=[machine_id],
        doc="The machine used.",
    )

    run: Mapped["ProcessRun | None"] = relationship(
        "ProcessRun",
        back_populates="time_logs",
    )

    step: Mapped["ProcessStep | None"] = relationship(
        "ProcessStep",
        back_populates="time_logs",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<TimeLog id={self.id} "
            f"user_id={self.user_id} machine_id={self.machine_id} "
            f"duration={self.duration_minutes}min>"
        )
