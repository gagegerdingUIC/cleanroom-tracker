from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class MaterialPresetCreate(BaseModel):
    name: str
    preset_type: str
    default_parameters: Optional[dict[str, Any]] = None
    description: Optional[str] = None


class MaterialPresetUpdate(BaseModel):
    name: Optional[str] = None
    preset_type: Optional[str] = None
    default_parameters: Optional[dict[str, Any]] = None
    description: Optional[str] = None


class MaterialPresetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    preset_type: str
    default_parameters: Optional[dict[str, Any]]
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
