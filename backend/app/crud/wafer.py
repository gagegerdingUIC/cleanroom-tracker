from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models import Wafer
from app.schemas.wafer import WaferCreate, WaferUpdate


def list_wafers(db: Session) -> list[Wafer]:
    return db.query(Wafer).order_by(Wafer.created_at.desc()).all()


def get_wafer(db: Session, wafer_uuid: str) -> Wafer | None:
    return db.query(Wafer).filter(Wafer.id == uuid.UUID(wafer_uuid)).first()


def create_wafer(db: Session, data: WaferCreate) -> Wafer:
    wafer = Wafer(**data.model_dump())
    db.add(wafer)
    db.commit()
    db.refresh(wafer)
    return wafer


def update_wafer(db: Session, wafer: Wafer, data: WaferUpdate) -> Wafer:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(wafer, field, value)
    db.commit()
    db.refresh(wafer)
    return wafer


def delete_wafer(db: Session, wafer: Wafer) -> None:
    db.delete(wafer)
    db.commit()
