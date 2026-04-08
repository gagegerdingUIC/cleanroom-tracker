from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import wafer as crud
from app.schemas.wafer import WaferCreate, WaferRead, WaferUpdate

router = APIRouter(prefix="/api/v1/wafers", tags=["wafers"])


@router.get("", response_model=list[WaferRead])
def list_wafers(db: Session = Depends(get_db)):
    return crud.list_wafers(db)


@router.post("", response_model=WaferRead, status_code=201)
def create_wafer(data: WaferCreate, db: Session = Depends(get_db)):
    return crud.create_wafer(db, data)


@router.get("/{wafer_id}", response_model=WaferRead)
def get_wafer(wafer_id: str, db: Session = Depends(get_db)):
    wafer = crud.get_wafer(db, wafer_id)
    if not wafer:
        raise HTTPException(404, "Wafer not found")
    return wafer


@router.patch("/{wafer_id}", response_model=WaferRead)
def update_wafer(wafer_id: str, data: WaferUpdate, db: Session = Depends(get_db)):
    wafer = crud.get_wafer(db, wafer_id)
    if not wafer:
        raise HTTPException(404, "Wafer not found")
    return crud.update_wafer(db, wafer, data)


@router.delete("/{wafer_id}", status_code=204)
def delete_wafer(wafer_id: str, db: Session = Depends(get_db)):
    wafer = crud.get_wafer(db, wafer_id)
    if not wafer:
        raise HTTPException(404, "Wafer not found")
    crud.delete_wafer(db, wafer)
