from __future__ import annotations

import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.machine import MachineCategory, ParamDataType, ParamType


class MachineParameterDefinitionCreate(BaseModel):
    name: str
    display_name: str
    param_type: ParamType = ParamType.input
    data_type: ParamDataType = ParamDataType.float_
    unit: Optional[str] = None
    is_required: bool = False
    default_value: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    sort_order: int = 0


class MachineCreate(BaseModel):
    name: str
    abbreviation: str
    category: MachineCategory
    notes: Optional[str] = None
    parameter_definitions: list[MachineParameterDefinitionCreate] = []


class MachineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: MachineCategory
    abbreviation: str
    is_active: bool


class MachineParameterDefinitionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    machine_id: uuid.UUID
    name: str
    display_name: str
    param_type: ParamType
    data_type: ParamDataType
    unit: Optional[str]
    is_required: bool
    default_value: Optional[str]
    min_value: Optional[float]
    max_value: Optional[float]
    sort_order: int


class StepParameterValueCreate(BaseModel):
    param_def_id: Optional[uuid.UUID] = None
    param_name: str
    value_raw: str
    value_numeric: Optional[float] = None
    unit: Optional[str] = None


class StepParameterValueRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    param_def_id: Optional[uuid.UUID]
    param_name: str
    value_raw: str
    value_numeric: Optional[float]
    unit: Optional[str]
