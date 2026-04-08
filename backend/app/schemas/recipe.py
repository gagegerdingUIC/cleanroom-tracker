from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class RecipeStepParamCreate(BaseModel):
    name: str
    display_name: str
    unit: Optional[str] = None
    default_value: Optional[str] = None


class RecipeStepCreate(BaseModel):
    step_index: int
    name: str
    category: Optional[str] = None
    machine_id: Optional[uuid.UUID] = None
    expected_parameters: list[RecipeStepParamCreate] = []
    notes: Optional[str] = None


class RecipeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    machine_id: Optional[uuid.UUID] = None
    is_template: bool = True
    steps: list[RecipeStepCreate] = []


class RecipeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    machine_id: Optional[uuid.UUID] = None
    is_template: Optional[bool] = None
    steps: Optional[list[RecipeStepCreate]] = None


class RecipeStepRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    recipe_id: uuid.UUID
    step_index: int
    name: str
    category: Optional[str]
    machine_id: Optional[uuid.UUID]
    expected_parameters: Optional[list] = []
    notes: Optional[str]


class RecipeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: Optional[str]
    category: str
    machine_id: Optional[uuid.UUID]
    is_template: bool
    steps: list[RecipeStepRead] = []
    created_at: datetime
