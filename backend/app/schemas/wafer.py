from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.wafer import DopingType, WaferShape, WaferStatus


class WaferCreate(BaseModel):
    wafer_id: str
    material: str
    diameter_mm: float
    shape: WaferShape = WaferShape.circular
    doping_type: DopingType
    doping_level: Optional[float] = None
    resistivity_ohm_cm: Optional[float] = None
    crystal_orientation: Optional[str] = None
    vendor: Optional[str] = None
    lot_number: Optional[str] = None
    status: WaferStatus = WaferStatus.active
    is_recycled: bool = False
    recycled_from_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    folder_id: Optional[uuid.UUID] = None
    carrier_id: Optional[uuid.UUID] = None
    slot_number: Optional[int] = None


class WaferUpdate(BaseModel):
    wafer_id: Optional[str] = None
    material: Optional[str] = None
    diameter_mm: Optional[float] = None
    shape: Optional[WaferShape] = None
    doping_type: Optional[DopingType] = None
    doping_level: Optional[float] = None
    resistivity_ohm_cm: Optional[float] = None
    crystal_orientation: Optional[str] = None
    vendor: Optional[str] = None
    lot_number: Optional[str] = None
    status: Optional[WaferStatus] = None
    is_recycled: Optional[bool] = None
    recycled_from_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    folder_id: Optional[uuid.UUID] = None
    carrier_id: Optional[uuid.UUID] = None
    slot_number: Optional[int] = None


class WaferRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    wafer_id: str
    material: str
    diameter_mm: float
    shape: WaferShape
    doping_type: DopingType
    doping_level: Optional[float]
    resistivity_ohm_cm: Optional[float]
    crystal_orientation: Optional[str]
    vendor: Optional[str]
    lot_number: Optional[str]
    status: WaferStatus
    is_recycled: bool
    recycled_from_id: Optional[uuid.UUID]
    notes: Optional[str]
    folder_id: Optional[uuid.UUID]
    carrier_id: Optional[uuid.UUID]
    slot_number: Optional[int]
    created_at: datetime
    updated_at: datetime
