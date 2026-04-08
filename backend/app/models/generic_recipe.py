"""
generic_recipe.py — Recipe and RecipeStep.

A Recipe is a named, ordered sequence of process steps used as a template.
Unlike EtchRecipe (etch-specific with gas flows and RF power), a generic
Recipe just captures ordered step names with expected parameter hints.
"""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from .base import Base, EntityMixin

if TYPE_CHECKING:
    from .machine import Machine


class Recipe(EntityMixin, Base):
    __tablename__ = "recipes"

    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(30), nullable=False)

    machine_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("machines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    is_template: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    machine: Mapped["Machine | None"] = relationship("Machine")
    steps: Mapped[list["RecipeStep"]] = relationship(
        "RecipeStep",
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="RecipeStep.step_index",
    )

    def __repr__(self) -> str:
        return f"<Recipe id={self.id} name={self.name!r}>"


class RecipeStep(EntityMixin, Base):
    __tablename__ = "recipe_steps"

    recipe_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("recipes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    category: Mapped[str | None] = mapped_column(String(30), nullable=True)

    machine_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("machines.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Expected parameters as JSON: [{"name": "...", "display_name": "...", "unit": "...", "default_value": "..."}]
    expected_parameters: Mapped[list | None] = mapped_column(
        JSON, nullable=True, default=list
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    recipe: Mapped["Recipe"] = relationship("Recipe", back_populates="steps")
    machine: Mapped["Machine | None"] = relationship("Machine")

    def __repr__(self) -> str:
        return f"<RecipeStep id={self.id} recipe_id={self.recipe_id} index={self.step_index}>"
