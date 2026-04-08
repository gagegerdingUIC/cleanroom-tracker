"""
attachment.py — DataAttachment.

Any file linked to a process step, run, or die.  DataAttachment records
metadata (type, path, checksum) and points to the stored file — the
file itself lives in the storage backend (local filesystem in phase 1,
S3-compatible in phase 2).

Parser integration:
    For known instrument formats, a parser function is registered in
    the parsers module.  When a file is uploaded the API triggers the
    matching parser, which converts the proprietary format to a
    normalised CSV/dict and writes the output alongside the raw file.
    The raw file is ALWAYS preserved; parsed_data_path is supplementary.
    If no parser is registered, the attachment is stored as-is and
    parser_id remains null.

Polymorphic parent:
    Exactly one of step_id, run_id, die_id should be non-null.
    - step_id  → attachment belongs to a specific wafer step
    - run_id   → run-level attachment (e.g. machine log for the full run)
    - die_id   → post-dicing attachment (e.g. wire-bonded chip photo)
    Application logic enforces this; no DB CHECK constraint for SQLite
    compatibility.
"""

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from .base import Base, EntityMixin

if TYPE_CHECKING:
    from .die import Die
    from .process import ProcessRun, ProcessStep


class AttachmentType(str, enum.Enum):
    image = "image"
    csv = "csv"
    raw_instrument = "raw_instrument"
    graph = "graph"
    manual_table = "manual_table"
    other = "other"


class DataAttachment(EntityMixin, Base):
    """
    Metadata record for a file attached to a step, run, or die.

    The file is stored in the configured storage backend; this row
    tracks where it is, what it is, and whether it has been parsed.
    """

    __tablename__ = "data_attachments"

    # ------------------------------------------------------------------
    # Polymorphic parent (exactly one should be non-null)
    # ------------------------------------------------------------------

    step_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("process_steps.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        doc="Parent step.  Null if this is a run-level or die-level attachment.",
    )

    run_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("process_runs.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        doc="Parent run.  Null if this is a step-level or die-level attachment.",
    )

    die_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("dies.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        doc="Parent die.  Null if this is a step-level or run-level attachment.",
    )

    # ------------------------------------------------------------------
    # File metadata
    # ------------------------------------------------------------------

    attachment_type: Mapped[AttachmentType] = mapped_column(
        String(30),
        nullable=False,
        doc="Broad category of the file content.",
    )

    label: Mapped[str] = mapped_column(
        String(256),
        nullable=False,
        doc="Human-readable label, e.g. 'Post-etch profilometer scan', 'SEM image'.",
    )

    file_path: Mapped[str] = mapped_column(
        String(1024),
        nullable=False,
        doc=(
            "Path in the storage backend.  For local storage: "
            "/data/{owner_id}/{wafer_id}/{step_id}/{filename}.  "
            "For S3: s3://bucket/prefix/filename."
        ),
    )

    original_filename: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        doc="Original filename as uploaded by the user.",
    )

    mime_type: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        doc="MIME type, e.g. 'image/png', 'text/csv', 'application/octet-stream'.",
    )

    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        doc="File size in bytes at upload time.",
    )

    checksum_sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        doc="SHA-256 hex digest of the raw file for integrity verification.",
    )

    # ------------------------------------------------------------------
    # Parser fields (populated after parse, null before)
    # ------------------------------------------------------------------

    parser_id: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
        doc=(
            "Identifier of the parser used, e.g. 'p7_profilometer_v1'.  "
            "Null if no parser matched or parsing has not been attempted."
        ),
    )

    parsed_data_path: Mapped[str | None] = mapped_column(
        String(1024),
        nullable=True,
        doc=(
            "Path to the normalised output file (e.g. converted CSV).  "
            "The raw file is always preserved separately."
        ),
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    step: Mapped["ProcessStep | None"] = relationship(
        "ProcessStep",
        foreign_keys=[step_id],
        back_populates="attachments",
    )

    run: Mapped["ProcessRun | None"] = relationship(
        "ProcessRun",
        foreign_keys=[run_id],
        back_populates="attachments",
    )

    die: Mapped["Die | None"] = relationship(
        "Die",
        foreign_keys=[die_id],
        back_populates="attachments",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<DataAttachment id={self.id} "
            f"label={self.label!r} type={self.attachment_type}>"
        )
