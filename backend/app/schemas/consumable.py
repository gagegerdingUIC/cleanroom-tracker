from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.consumable import ConsumableType


class ConsumableCreate(BaseModel):
    name: str
    consumable_type: ConsumableType
    manufacturer: Optional[str] = None
    lot_number: Optional[str] = None
    expiration_date: Optional[date] = None
    is_active: bool = True
    notes: Optional[str] = None


class ConsumableUpdate(BaseModel):
    expiration_date: Optional[date] = None
    lot_number: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class ConsumableRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    consumable_type: ConsumableType
    manufacturer: Optional[str]
    lot_number: Optional[str]
    expiration_date: Optional[date]
    is_active: bool
    notes: Optional[str]
    created_at: datetime
