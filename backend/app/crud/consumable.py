from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.consumable import Consumable, ConsumableType
from app.schemas.consumable import ConsumableCreate, ConsumableUpdate


def list_consumables(
    db: Session, consumable_type: ConsumableType | None = None
) -> list[Consumable]:
    q = db.query(Consumable).filter(Consumable.is_active == True)  # noqa: E712
    if consumable_type:
        q = q.filter(Consumable.consumable_type == consumable_type)
    return q.order_by(Consumable.name).all()


def get_consumable(db: Session, consumable_uuid: str) -> Consumable | None:
    return (
        db.query(Consumable)
        .filter(Consumable.id == uuid.UUID(consumable_uuid))
        .first()
    )


def create_consumable(db: Session, data: ConsumableCreate) -> Consumable:
    consumable = Consumable(**data.model_dump())
    db.add(consumable)
    db.commit()
    db.refresh(consumable)
    return consumable


def update_consumable(
    db: Session, consumable: Consumable, data: ConsumableUpdate
) -> Consumable:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(consumable, field, value)
    db.commit()
    db.refresh(consumable)
    return consumable


def delete_consumable(db: Session, consumable: Consumable) -> None:
    db.delete(consumable)
    db.commit()
