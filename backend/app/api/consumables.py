from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import consumable as crud
from app.models.consumable import ConsumableType
from app.schemas.consumable import ConsumableCreate, ConsumableRead, ConsumableUpdate

router = APIRouter(prefix="/api/v1/consumables", tags=["consumables"])


@router.get("", response_model=list[ConsumableRead])
def list_consumables(
    consumable_type: ConsumableType | None = Query(None),
    db: Session = Depends(get_db),
):
    return crud.list_consumables(db, consumable_type)


@router.post("", response_model=ConsumableRead, status_code=201)
def create_consumable(data: ConsumableCreate, db: Session = Depends(get_db)):
    return crud.create_consumable(db, data)


@router.get("/{consumable_id}", response_model=ConsumableRead)
def get_consumable(consumable_id: str, db: Session = Depends(get_db)):
    c = crud.get_consumable(db, consumable_id)
    if not c:
        raise HTTPException(404, "Consumable not found")
    return c


@router.patch("/{consumable_id}", response_model=ConsumableRead)
def update_consumable(
    consumable_id: str,
    data: ConsumableUpdate,
    db: Session = Depends(get_db),
):
    c = crud.get_consumable(db, consumable_id)
    if not c:
        raise HTTPException(404, "Consumable not found")
    return crud.update_consumable(db, c, data)


@router.delete("/{consumable_id}", status_code=204)
def delete_consumable(consumable_id: str, db: Session = Depends(get_db)):
    c = crud.get_consumable(db, consumable_id)
    if not c:
        raise HTTPException(404, "Consumable not found")
    crud.delete_consumable(db, c)
