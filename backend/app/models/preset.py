"""
preset.py — MaterialPreset entity.

A MaterialPreset stores default process parameters for a given material
(e.g. photoresist AZ1518).  When the user selects a preset in the
process builder, the default parameters are auto-filled across all
related step types.

JSON structure of default_parameters:
{
    "spin_coat": {"spin_speed_rpm": "4000", "spin_time_s": "45"},
    "softbake": {"temp_c": "100", "duration_s": "60"},
    "exposure": {"dose_mj_cm2": "25"},
    "develop": {"developer": "AZ 300 MIF", "duration_s": "60"}
}
"""

from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, EntityMixin


class MaterialPreset(EntityMixin, Base):
    __tablename__ = "material_presets"

    name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        doc="Material name, e.g. 'AZ1518', 'AZ5214'.",
    )

    preset_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        doc="Category: photoresist, developer, etchant, etc.",
    )

    default_parameters: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        doc="Nested JSON mapping step types to default parameter values.",
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="Optional notes about this preset.",
    )

    def __repr__(self) -> str:
        return f"<MaterialPreset id={self.id} name={self.name!r} type={self.preset_type!r}>"
