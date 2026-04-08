from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.crud import preset as crud
from app.schemas.preset import MaterialPresetCreate, MaterialPresetRead, MaterialPresetUpdate

router = APIRouter(prefix="/api/v1/presets", tags=["presets"])


@router.get("", response_model=list[MaterialPresetRead])
def list_presets(
    preset_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return crud.list_presets(db, preset_type=preset_type)


@router.post("", response_model=MaterialPresetRead, status_code=201)
def create_preset(data: MaterialPresetCreate, db: Session = Depends(get_db)):
    return crud.create_preset(db, data)


@router.get("/{preset_id}", response_model=MaterialPresetRead)
def get_preset(preset_id: str, db: Session = Depends(get_db)):
    preset = crud.get_preset(db, preset_id)
    if not preset:
        raise HTTPException(404, "Preset not found")
    return preset


@router.patch("/{preset_id}", response_model=MaterialPresetRead)
def update_preset(
    preset_id: str, data: MaterialPresetUpdate, db: Session = Depends(get_db)
):
    preset = crud.get_preset(db, preset_id)
    if not preset:
        raise HTTPException(404, "Preset not found")
    return crud.update_preset(db, preset, data)


@router.delete("/{preset_id}", status_code=204)
def delete_preset(preset_id: str, db: Session = Depends(get_db)):
    preset = crud.get_preset(db, preset_id)
    if not preset:
        raise HTTPException(404, "Preset not found")
    crud.delete_preset(db, preset)
