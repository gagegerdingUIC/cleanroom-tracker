from __future__ import annotations

import uuid

from sqlalchemy.orm import Session, selectinload

from app.models.generic_recipe import Recipe, RecipeStep
from app.schemas.recipe import RecipeCreate, RecipeUpdate


def list_recipes(db: Session) -> list[Recipe]:
    return (
        db.query(Recipe)
        .options(selectinload(Recipe.steps))
        .order_by(Recipe.name)
        .all()
    )


def get_recipe(db: Session, recipe_uuid: str) -> Recipe | None:
    return (
        db.query(Recipe)
        .options(selectinload(Recipe.steps))
        .filter(Recipe.id == uuid.UUID(recipe_uuid))
        .first()
    )


def create_recipe(db: Session, data: RecipeCreate) -> Recipe:
    steps_data = data.steps
    recipe_dict = data.model_dump(exclude={"steps"})
    recipe = Recipe(**recipe_dict)
    db.add(recipe)
    db.flush()

    for step in steps_data:
        rs = RecipeStep(
            recipe_id=recipe.id,
            step_index=step.step_index,
            name=step.name,
            category=step.category,
            machine_id=step.machine_id,
            expected_parameters=[p.model_dump() for p in step.expected_parameters],
            notes=step.notes,
        )
        db.add(rs)

    db.commit()
    db.refresh(recipe)
    return recipe


def update_recipe(db: Session, recipe: Recipe, data: RecipeUpdate) -> Recipe:
    update_data = data.model_dump(exclude_unset=True)
    steps_data = update_data.pop("steps", None)

    for field, value in update_data.items():
        setattr(recipe, field, value)

    if steps_data is not None:
        # Replace all steps
        for s in recipe.steps:
            db.delete(s)
        db.flush()
        for step in steps_data:
            params = step.pop("expected_parameters", [])
            rs = RecipeStep(
                recipe_id=recipe.id,
                expected_parameters=[p for p in params] if params else [],
                **step,
            )
            db.add(rs)

    db.commit()
    db.refresh(recipe)
    return recipe


def delete_recipe(db: Session, recipe: Recipe) -> None:
    db.delete(recipe)
    db.commit()
