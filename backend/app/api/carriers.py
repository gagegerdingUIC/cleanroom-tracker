from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import carrier as crud
from app.schemas.carrier import CarrierCreate, CarrierRead, CarrierUpdate

router = APIRouter(prefix="/api/v1/carriers", tags=["carriers"])


@router.get("", response_model=list[CarrierRead])
def list_carriers(db: Session = Depends(get_db)):
    return crud.list_carriers(db)


@router.post("", response_model=CarrierRead, status_code=201)
def create_carrier(data: CarrierCreate, db: Session = Depends(get_db)):
    return crud.create_carrier(db, data)


@router.get("/{carrier_id}", response_model=CarrierRead)
def get_carrier(carrier_id: str, db: Session = Depends(get_db)):
    carrier = crud.get_carrier(db, carrier_id)
    if not carrier:
        raise HTTPException(404, "Carrier not found")
    return carrier


@router.patch("/{carrier_id}", response_model=CarrierRead)
def update_carrier(
    carrier_id: str, data: CarrierUpdate, db: Session = Depends(get_db)
):
    carrier = crud.get_carrier(db, carrier_id)
    if not carrier:
        raise HTTPException(404, "Carrier not found")
    return crud.update_carrier(db, carrier, data)


@router.delete("/{carrier_id}", status_code=204)
def delete_carrier(carrier_id: str, db: Session = Depends(get_db)):
    carrier = crud.get_carrier(db, carrier_id)
    if not carrier:
        raise HTTPException(404, "Carrier not found")
    crud.delete_carrier(db, carrier)
