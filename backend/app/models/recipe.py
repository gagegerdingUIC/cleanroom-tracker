"""
recipe.py — EtchRecipe, EtchRecipeStep, EtchRecipeGasFlow.

STATUS: DORMANT — No API endpoints or CRUD layer exist for this model.
Kept because ProcessStep.etch_recipe_id FK depends on the etch_recipes table.
The ACTIVE recipe system is generic_recipe.py (Recipe/RecipeStep), served
by api/recipes.py and crud/recipe.py.

Etch recipes are named, structured run specifications for the ICP-RIE
(or ALE, or other etch tool).  The model supports two usage modes:

  Library recipe  (is_template=True):
      A named recipe saved to the library.  Can be selected from a
      dropdown when logging an etch step.  Shared across runs.

  One-off recipe  (is_template=False):
      Created fresh for a specific run.  Can optionally be promoted to
      the library (flip is_template=True and give it a name) after the
      run if the result was good.

Derivation:
    created_from_id lets you track recipe lineage — 'Nb_etch_v3' was
    derived from 'Nb_etch_v2', which was derived from 'Nb_etch_v1'.

Structure:
    EtchRecipe → N × EtchRecipeStep (ordered by step_index)
               → each step has M × EtchRecipeGasFlow (variable gases)

Gas flows are in a separate table because the gases used vary per
recipe (one recipe uses Ar+Cl₂, another uses SF₆+O₂).  This avoids
sparse nullable columns for each possible gas and makes it easy to add
new gases without schema changes.
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from .base import Base, EntityMixin

if TYPE_CHECKING:
    from .machine import Machine
    from .process import ProcessStep


class EtchRecipe(EntityMixin, Base):
    """
    A named etch recipe — either a saved library template or a one-off run spec.

    An EtchRecipe consists of one or more EtchRecipeSteps executed in
    sequence.  Each step controls pressure, RF powers, gas flows, and
    timing for that phase of the etch.
    """

    __tablename__ = "etch_recipes"

    name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        doc=(
            "Human name for the recipe, e.g. 'Nb_etch_v3', 'NbTi_ALE_v1'.  "
            "Required for library recipes (is_template=True).  "
            "For one-offs, can default to an auto-generated label."
        ),
    )

    machine_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("machines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="The etch machine this recipe runs on.  Null if machine-agnostic.",
    )

    is_template: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        doc=(
            "True = saved library recipe, selectable from the recipe dropdown.  "
            "False = one-off run, created for a specific step and not shown "
            "in the library by default."
        ),
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="Human-readable description of the recipe, intended use, known results.",
    )

    created_from_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("etch_recipes.id", ondelete="SET NULL"),
        nullable=True,
        doc=(
            "If this recipe was derived from an existing one, FK to the parent. "
            "Enables recipe lineage tracking."
        ),
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    machine: Mapped["Machine | None"] = relationship(
        "Machine",
        doc="The etch tool this recipe targets.",
    )

    recipe_steps: Mapped[list["EtchRecipeStep"]] = relationship(
        "EtchRecipeStep",
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="EtchRecipeStep.step_index",
        doc="Ordered list of recipe steps (phases of the etch).",
    )

    parent_recipe: Mapped["EtchRecipe | None"] = relationship(
        "EtchRecipe",
        remote_side="EtchRecipe.id",
        foreign_keys=[created_from_id],
        doc="The recipe this one was derived from.",
    )

    derived_recipes: Mapped[list["EtchRecipe"]] = relationship(
        "EtchRecipe",
        foreign_keys=[created_from_id],
        back_populates="parent_recipe",
        doc="Recipes derived from this one.",
    )

    steps: Mapped[list["ProcessStep"]] = relationship(
        "ProcessStep",
        back_populates="etch_recipe",
        doc="Process steps that used this recipe.",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<EtchRecipe id={self.id} name={self.name!r} "
            f"template={self.is_template}>"
        )


class EtchRecipeStep(EntityMixin, Base):
    """
    One phase within an EtchRecipe.  Phases execute in ascending
    step_index order.

    Each phase specifies the chamber conditions for its duration.  Gas
    flows are in a separate EtchRecipeGasFlow table because the set of
    gases varies per recipe.
    """

    __tablename__ = "etch_recipe_steps"

    recipe_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("etch_recipes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="The parent recipe.",
    )

    step_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        doc="Zero-based execution order within the recipe.",
    )

    # ------------------------------------------------------------------
    # Chamber conditions
    # ------------------------------------------------------------------

    pressure_mtorr: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        doc="Chamber pressure in mTorr.",
    )

    top_rf_w: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        doc="Top/ICP RF power in Watts.",
    )

    bottom_rf_w: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        doc="Bottom/bias RF power in Watts.",
    )

    rf_stabilization_time_s: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        doc=(
            "Time in seconds to allow RF to stabilise before processing "
            "begins (plasma on but shutter closed)."
        ),
    )

    processing_time_s: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        doc="Active processing / etch time in seconds.",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="Notes specific to this phase, e.g. 'descum step', 'main etch'.",
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    recipe: Mapped["EtchRecipe"] = relationship(
        "EtchRecipe",
        back_populates="recipe_steps",
    )

    gas_flows: Mapped[list["EtchRecipeGasFlow"]] = relationship(
        "EtchRecipeGasFlow",
        back_populates="recipe_step",
        cascade="all, delete-orphan",
        doc="Gas flows active during this recipe phase.",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<EtchRecipeStep id={self.id} "
            f"recipe_id={self.recipe_id} index={self.step_index}>"
        )


class EtchRecipeGasFlow(EntityMixin, Base):
    """
    A single gas flow setpoint for one phase of an etch recipe.

    Each EtchRecipeStep can have any number of gas flows.  Common gases
    include Ar, Cl₂, SF₆, O₂, BCl₃, CHF₃.  Storing them as rows (not
    columns) avoids sparse nullable columns and allows adding new gases
    without schema changes.
    """

    __tablename__ = "etch_recipe_gas_flows"

    recipe_step_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("etch_recipe_steps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="The parent recipe step.",
    )

    gas: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        doc="Gas formula, e.g. 'Ar', 'Cl2', 'SF6', 'O2', 'BCl3', 'CHF3'.",
    )

    flow_sccm: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        doc="Volumetric flow rate in standard cubic centimetres per minute (sccm).",
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------

    recipe_step: Mapped["EtchRecipeStep"] = relationship(
        "EtchRecipeStep",
        back_populates="gas_flows",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<EtchRecipeGasFlow id={self.id} "
            f"gas={self.gas!r} flow={self.flow_sccm} sccm>"
        )
