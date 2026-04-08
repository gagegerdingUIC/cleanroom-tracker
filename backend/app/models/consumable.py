"""
consumable.py — Consumable chemicals (photoresists, developers, solvents).

Tracks name, type, lot number, and expiration date so litho forms can
warn when a chemical is expired or nearing expiration.
"""

import enum

from sqlalchemy import Boolean, Date, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, EntityMixin


class ConsumableType(str, enum.Enum):
    photoresist = "photoresist"
    developer = "developer"
    solvent = "solvent"
    etchant = "etchant"
    other = "other"


class Consumable(EntityMixin, Base):
    __tablename__ = "consumables"

    name: Mapped[str] = mapped_column(String(128), nullable=False)
    consumable_type: Mapped[ConsumableType] = mapped_column(nullable=False)
    manufacturer: Mapped[str | None] = mapped_column(String(128), nullable=True)
    lot_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    expiration_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Consumable id={self.id} name={self.name!r} type={self.consumable_type}>"
