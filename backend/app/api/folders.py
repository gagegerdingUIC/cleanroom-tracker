from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
import uuid

from app.core.database import get_db
from app.crud import folder as crud
from app.crud import wafer as wafer_crud
from app.schemas.folder import FolderCreate, FolderRead, FolderUpdate
from app.schemas.wafer import WaferRead

router = APIRouter(prefix="/api/v1/folders", tags=["folders"])


@router.get("", response_model=list[FolderRead])
def list_folders(db: Session = Depends(get_db)):
    return crud.list_folders(db)


@router.post("", response_model=FolderRead, status_code=201)
def create_folder(data: FolderCreate, db: Session = Depends(get_db)):
    return crud.create_folder(db, data)


@router.patch("/{folder_id}", response_model=FolderRead)
def update_folder(folder_id: str, data: FolderUpdate, db: Session = Depends(get_db)):
    folder = crud.get_folder(db, folder_id)
    if not folder:
        raise HTTPException(404, "Folder not found")
    return crud.update_folder(db, folder, data)


@router.delete("/{folder_id}", status_code=204)
def delete_folder(folder_id: str, db: Session = Depends(get_db)):
    folder = crud.get_folder(db, folder_id)
    if not folder:
        raise HTTPException(404, "Folder not found")
    crud.delete_folder(db, folder)


class MoveWaferBody(BaseModel):
    folder_id: Optional[uuid.UUID] = None


@router.patch("/wafers/{wafer_id}/folder", response_model=WaferRead)
def move_wafer_to_folder(
    wafer_id: str, body: MoveWaferBody, db: Session = Depends(get_db)
):
    wafer = wafer_crud.get_wafer(db, wafer_id)
    if not wafer:
        raise HTTPException(404, "Wafer not found")
    updated = crud.move_wafer_to_folder(db, wafer, body.folder_id)
    return updated
