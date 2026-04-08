from __future__ import annotations

import uuid

from sqlalchemy.orm import Session, selectinload

from app.models import Carrier
from app.schemas.carrier import CarrierCreate, CarrierUpdate


def list_carriers(db: Session) -> list[Carrier]:
    return (
        db.query(Carrier)
        .options(selectinload(Carrier.wafers))
        .order_by(Carrier.created_at)
        .all()
    )


def get_carrier(db: Session, carrier_uuid: str) -> Carrier | None:
    return (
        db.query(Carrier)
        .options(selectinload(Carrier.wafers))
        .filter(Carrier.id == uuid.UUID(carrier_uuid))
        .first()
    )


def create_carrier(db: Session, data: CarrierCreate) -> Carrier:
    carrier = Carrier(**data.model_dump())
    db.add(carrier)
    db.commit()
    db.refresh(carrier)
    return carrier


def update_carrier(db: Session, carrier: Carrier, data: CarrierUpdate) -> Carrier:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(carrier, field, value)
    db.commit()
    db.refresh(carrier)
    return carrier


def delete_carrier(db: Session, carrier: Carrier) -> None:
    db.delete(carrier)
    db.commit()
