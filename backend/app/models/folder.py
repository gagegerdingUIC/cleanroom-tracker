"""
folder.py — WaferFolder entity.

Folders allow users to organise wafers into custom project groups
(e.g. "GaN HEMTs", "Solar Cells").  Supports nesting via parent_id.
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from .base import Base, EntityMixin

if TYPE_CHECKING:
    from .wafer import Wafer


class WaferFolder(EntityMixin, Base):
    __tablename__ = "wafer_folders"

    name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        doc="User-defined folder name.",
    )

    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("wafer_folders.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        doc="Parent folder for nesting. Null = top-level.",
    )

    sort_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        doc="Display order among siblings.",
    )

    parent: Mapped["WaferFolder | None"] = relationship(
        "WaferFolder",
        remote_side="WaferFolder.id",
        back_populates="children",
    )

    children: Mapped[list["WaferFolder"]] = relationship(
        "WaferFolder",
        back_populates="parent",
        cascade="all, delete-orphan",
    )

    wafers: Mapped[list["Wafer"]] = relationship(
        "Wafer",
        back_populates="folder",
    )

    def __repr__(self) -> str:
        return f"<WaferFolder id={self.id} name={self.name!r}>"
