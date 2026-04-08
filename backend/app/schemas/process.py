from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.process import StepCategory, StepStatus

from .machine import StepParameterValueCreate, StepParameterValueRead


class ProcessStepCreate(BaseModel):
    wafer_id: uuid.UUID
    name: str
    category: StepCategory
    timestamp_start: datetime
    timestamp_end: Optional[datetime] = None
    machine_id: Optional[uuid.UUID] = None
    step_number: Optional[int] = None
    status: StepStatus = StepStatus.completed
    notes: Optional[str] = None
    parameter_values: list[StepParameterValueCreate] = []


class ProcessStepUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[StepCategory] = None
    timestamp_start: Optional[datetime] = None
    timestamp_end: Optional[datetime] = None
    machine_id: Optional[uuid.UUID] = None
    step_number: Optional[int] = None
    status: Optional[StepStatus] = None
    notes: Optional[str] = None
    is_anomalous: Optional[bool] = None
    parameter_values: Optional[list[StepParameterValueCreate]] = None


class ProcessStepRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    wafer_id: uuid.UUID
    name: str
    category: StepCategory
    timestamp_start: datetime
    timestamp_end: Optional[datetime]
    machine_id: Optional[uuid.UUID]
    step_number: Optional[int]
    status: StepStatus
    is_anomalous: bool
    notes: Optional[str]
    run_id: Optional[uuid.UUID] = None
    created_at: datetime
    parameter_values: list[StepParameterValueRead] = []


# ---------------------------------------------------------------------------
# Batch / ProcessRun
# ---------------------------------------------------------------------------

class BatchStepCreate(BaseModel):
    """Create a ProcessRun and one ProcessStep per wafer."""
    wafer_ids: list[uuid.UUID]
    run_label: str
    name: str
    category: StepCategory
    timestamp_start: datetime
    timestamp_end: Optional[datetime] = None
    machine_id: Optional[uuid.UUID] = None
    step_number: Optional[int] = None
    status: StepStatus = StepStatus.completed
    notes: Optional[str] = None
    parameter_values: list[StepParameterValueCreate] = []


class ProcessRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    run_label: str
    machine_id: Optional[uuid.UUID]
    category: StepCategory
    timestamp_start: datetime
    timestamp_end: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    steps: list[ProcessStepRead] = []
