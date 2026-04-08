from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class MeasurementPointCreate(BaseModel):
    x_um: float
    y_um: float
    p7_x: Optional[float] = None
    p7_y: Optional[float] = None
    value: float
    upper_material: Optional[str] = None
    lower_material: Optional[str] = None


class MeasurementPointRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    x_um: float
    y_um: float
    p7_x: Optional[float] = None
    p7_y: Optional[float] = None
    value: float
    upper_material: Optional[str] = None
    lower_material: Optional[str] = None


class MeasurementCreate(BaseModel):
    step_id: uuid.UUID
    measurement_type: str = "step_height"
    instrument: str = "Stylus Profiler"
    intended_value: Optional[float] = None
    unit: str = "nm"
    notes: Optional[str] = None
    points: list[MeasurementPointCreate] = []


class MeasurementUpdate(BaseModel):
    instrument: Optional[str] = None
    intended_value: Optional[float] = None
    unit: Optional[str] = None
    notes: Optional[str] = None
    points: Optional[list[MeasurementPointCreate]] = None


class MeasurementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    step_id: uuid.UUID
    measurement_type: str
    instrument: str
    intended_value: Optional[float]
    unit: str
    notes: Optional[str]
    points: list[MeasurementPointRead] = []
    created_at: datetime
