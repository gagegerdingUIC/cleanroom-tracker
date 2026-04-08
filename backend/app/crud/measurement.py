from __future__ import annotations

import uuid

from sqlalchemy.orm import Session, selectinload

from app.models import Measurement, MeasurementPoint
from app.schemas.measurement import MeasurementCreate, MeasurementUpdate


def list_measurements_for_step(db: Session, step_uuid: str) -> list[Measurement]:
    return (
        db.query(Measurement)
        .options(selectinload(Measurement.points))
        .filter(Measurement.step_id == uuid.UUID(step_uuid))
        .order_by(Measurement.created_at)
        .all()
    )


def get_measurement(db: Session, measurement_uuid: str) -> Measurement | None:
    return (
        db.query(Measurement)
        .options(selectinload(Measurement.points))
        .filter(Measurement.id == uuid.UUID(measurement_uuid))
        .first()
    )


def create_measurement(db: Session, data: MeasurementCreate) -> Measurement:
    point_data = data.points
    m_dict = data.model_dump(exclude={"points"})
    measurement = Measurement(**m_dict)
    db.add(measurement)
    db.flush()

    for pt in point_data:
        mp = MeasurementPoint(measurement_id=measurement.id, **pt.model_dump())
        db.add(mp)

    db.commit()
    db.refresh(measurement)
    return measurement


def update_measurement(
    db: Session, measurement: Measurement, data: MeasurementUpdate
) -> Measurement:
    update_data = data.model_dump(exclude_unset=True)
    point_data = update_data.pop("points", None)

    for field, value in update_data.items():
        setattr(measurement, field, value)

    if point_data is not None:
        # Replace all points
        for pt in measurement.points:
            db.delete(pt)
        db.flush()
        for pt in point_data:
            mp = MeasurementPoint(measurement_id=measurement.id, **pt)
            db.add(mp)

    db.commit()
    db.refresh(measurement)
    return measurement


def delete_measurement(db: Session, measurement: Measurement) -> None:
    db.delete(measurement)
    db.commit()
