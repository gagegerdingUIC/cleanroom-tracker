from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CarrierCreate(BaseModel):
    name: str
    slot_count: int
    wafer_diameter_mm: float
    notes: Optional[str] = None


class CarrierUpdate(BaseModel):
    name: Optional[str] = None
    slot_count: Optional[int] = None
    wafer_diameter_mm: Optional[float] = None
    notes: Optional[str] = None


class CarrierRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slot_count: int
    wafer_diameter_mm: float
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
