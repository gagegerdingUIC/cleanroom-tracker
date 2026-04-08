from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import measurement as crud
from app.schemas.measurement import MeasurementCreate, MeasurementRead, MeasurementUpdate

router = APIRouter(tags=["measurements"])


@router.post("/api/v1/measurements", response_model=MeasurementRead, status_code=201)
def create_measurement(data: MeasurementCreate, db: Session = Depends(get_db)):
    return crud.create_measurement(db, data)


@router.get(
    "/api/v1/steps/{step_id}/measurements", response_model=list[MeasurementRead]
)
def list_measurements(step_id: str, db: Session = Depends(get_db)):
    return crud.list_measurements_for_step(db, step_id)


@router.get("/api/v1/measurements/{measurement_id}", response_model=MeasurementRead)
def get_measurement(measurement_id: str, db: Session = Depends(get_db)):
    m = crud.get_measurement(db, measurement_id)
    if not m:
        raise HTTPException(404, "Measurement not found")
    return m


@router.patch("/api/v1/measurements/{measurement_id}", response_model=MeasurementRead)
def update_measurement(
    measurement_id: str, data: MeasurementUpdate, db: Session = Depends(get_db)
):
    m = crud.get_measurement(db, measurement_id)
    if not m:
        raise HTTPException(404, "Measurement not found")
    return crud.update_measurement(db, m, data)


@router.delete("/api/v1/measurements/{measurement_id}", status_code=204)
def delete_measurement(measurement_id: str, db: Session = Depends(get_db)):
    m = crud.get_measurement(db, measurement_id)
    if not m:
        raise HTTPException(404, "Measurement not found")
    crud.delete_measurement(db, m)
