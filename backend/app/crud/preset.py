from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models.preset import MaterialPreset
from app.schemas.preset import MaterialPresetCreate, MaterialPresetUpdate


def list_presets(db: Session, preset_type: Optional[str] = None) -> list[MaterialPreset]:
    q = db.query(MaterialPreset)
    if preset_type:
        q = q.filter(MaterialPreset.preset_type == preset_type)
    return q.order_by(MaterialPreset.name).all()


def get_preset(db: Session, preset_uuid: str) -> MaterialPreset | None:
    return (
        db.query(MaterialPreset)
        .filter(MaterialPreset.id == uuid.UUID(preset_uuid))
        .first()
    )


def create_preset(db: Session, data: MaterialPresetCreate) -> MaterialPreset:
    preset = MaterialPreset(**data.model_dump())
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return preset


def update_preset(
    db: Session, preset: MaterialPreset, data: MaterialPresetUpdate
) -> MaterialPreset:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(preset, field, value)
    db.commit()
    db.refresh(preset)
    return preset


def delete_preset(db: Session, preset: MaterialPreset) -> None:
    db.delete(preset)
    db.commit()
