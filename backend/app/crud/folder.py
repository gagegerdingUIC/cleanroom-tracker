from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.folder import WaferFolder
from app.models.wafer import Wafer
from app.schemas.folder import FolderCreate, FolderUpdate


def list_folders(db: Session) -> list[WaferFolder]:
    return db.query(WaferFolder).order_by(WaferFolder.sort_order, WaferFolder.name).all()


def get_folder(db: Session, folder_uuid: str) -> WaferFolder | None:
    return db.query(WaferFolder).filter(WaferFolder.id == uuid.UUID(folder_uuid)).first()


def create_folder(db: Session, data: FolderCreate) -> WaferFolder:
    folder = WaferFolder(**data.model_dump())
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


def update_folder(db: Session, folder: WaferFolder, data: FolderUpdate) -> WaferFolder:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(folder, field, value)
    db.commit()
    db.refresh(folder)
    return folder


def delete_folder(db: Session, folder: WaferFolder) -> None:
    # Set folder_id to null for all wafers in this folder before deleting
    db.query(Wafer).filter(Wafer.folder_id == folder.id).update(
        {Wafer.folder_id: None}, synchronize_session="fetch"
    )
    db.delete(folder)
    db.commit()


def move_wafer_to_folder(
    db: Session, wafer: Wafer, folder_id: uuid.UUID | None
) -> Wafer:
    wafer.folder_id = folder_id
    db.commit()
    db.refresh(wafer)
    return wafer
