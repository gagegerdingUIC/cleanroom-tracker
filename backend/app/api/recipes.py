from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import recipe as crud
from app.schemas.recipe import RecipeCreate, RecipeRead, RecipeUpdate

router = APIRouter(prefix="/api/v1/recipes", tags=["recipes"])


@router.get("", response_model=list[RecipeRead])
def list_recipes(db: Session = Depends(get_db)):
    return crud.list_recipes(db)


@router.post("", response_model=RecipeRead, status_code=201)
def create_recipe(data: RecipeCreate, db: Session = Depends(get_db)):
    return crud.create_recipe(db, data)


@router.get("/{recipe_id}", response_model=RecipeRead)
def get_recipe(recipe_id: str, db: Session = Depends(get_db)):
    recipe = crud.get_recipe(db, recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    return recipe


@router.patch("/{recipe_id}", response_model=RecipeRead)
def update_recipe(recipe_id: str, data: RecipeUpdate, db: Session = Depends(get_db)):
    recipe = crud.get_recipe(db, recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    return crud.update_recipe(db, recipe, data)


@router.delete("/{recipe_id}", status_code=204)
def delete_recipe(recipe_id: str, db: Session = Depends(get_db)):
    recipe = crud.get_recipe(db, recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    crud.delete_recipe(db, recipe)
