"""
models/__init__.py

Import all ORM models here so that:
  1. Alembic's env.py can do `from app.models import Base` and find all
     table metadata via Base.metadata.
  2. SQLAlchemy's relationship resolution can locate all mapper classes
     when the package is imported, avoiding 'mapper not yet configured'
     errors with string-based relationship targets.
  3. Application code can import from `app.models` directly rather than
     navigating individual submodules.

Import order matters: models with no FK dependencies come first.
"""

from .base import Base, EntityMixin  # noqa: F401

# No FK dependencies
from .user import User, UserRole  # noqa: F401

# Depends on User (owner_id), self-referential parent_id
from .folder import WaferFolder  # noqa: F401

# Depends on User (owner_id)
from .carrier import Carrier  # noqa: F401

# Depends on User (owner_id), WaferFolder (folder_id), Carrier (carrier_id)
from .wafer import Wafer, WaferShape, DopingType, WaferStatus  # noqa: F401

# No FK dependencies (besides owner_id)
from .preset import MaterialPreset  # noqa: F401
from .machine import (  # noqa: F401
    Machine,
    MachineCategory,
    MachineParameterDefinition,
    ParamDataType,
    ParamType,
    StepParameterValue,
)

from .consumable import Consumable, ConsumableType  # noqa: F401

# Depends on Wafer
from .region import Region, RegionType, CoordinateSpace  # noqa: F401

# DORMANT etch-specific recipe system — no API/CRUD.
# Kept because ProcessStep.etch_recipe_id FK depends on the etch_recipes table.
from .recipe import (  # noqa: F401
    EtchRecipe,
    EtchRecipeStep,
    EtchRecipeGasFlow,
)

# ACTIVE recipe system — served by api/recipes.py and crud/recipe.py.
from .generic_recipe import Recipe, RecipeStep  # noqa: F401

# Depends on Wafer, Machine, Region, EtchRecipe
from .process import (  # noqa: F401
    ProcessRun,
    ProcessStep,
    ProcessEdge,
    StepCategory,
    StepStatus,
)

# Depends on Wafer, Region
from .die import Die, DieStatus  # noqa: F401

# Depends on ProcessStep, ProcessRun, Die
from .attachment import DataAttachment, AttachmentType  # noqa: F401

# Depends on ProcessStep
from .measurement import (  # noqa: F401
    Measurement,
    MeasurementPoint,
    MeasurementType,
)
from .layer import (  # noqa: F401
    LayerDescriptor,
    LayerType,
    ThicknessSource,
    EtchProfile,
)

# Depends on User, Machine, ProcessRun, ProcessStep
from .timelog import TimeLog  # noqa: F401

__all__ = [
    # ── Active ──────────────────────────────────────────────
    "Base",
    "EntityMixin",
    "WaferFolder",
    "Carrier",
    "Wafer",
    "WaferShape",
    "DopingType",
    "WaferStatus",
    "Machine",
    "MachineCategory",
    "MachineParameterDefinition",
    "ParamType",
    "ParamDataType",
    "StepParameterValue",
    "MaterialPreset",
    "Consumable",
    "ConsumableType",
    "Recipe",
    "RecipeStep",
    "ProcessRun",
    "ProcessStep",
    "ProcessEdge",
    "StepCategory",
    "StepStatus",
    "DataAttachment",
    "AttachmentType",
    "Measurement",
    "MeasurementPoint",
    "MeasurementType",
    # ── Dormant (kept for FK dependencies / future phases) ──
    "User",
    "UserRole",
    "Region",
    "RegionType",
    "CoordinateSpace",
    "EtchRecipe",
    "EtchRecipeStep",
    "EtchRecipeGasFlow",
    "Die",
    "DieStatus",
    "LayerDescriptor",
    "LayerType",
    "ThicknessSource",
    "EtchProfile",
    "TimeLog",
]
