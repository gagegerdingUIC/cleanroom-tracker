from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import process as crud
from app.schemas.process import ProcessStepCreate, ProcessStepRead, ProcessStepUpdate

router = APIRouter(tags=["steps"])


@router.post("/api/v1/steps", response_model=ProcessStepRead, status_code=201)
def create_step(data: ProcessStepCreate, db: Session = Depends(get_db)):
    return crud.create_step(db, data)


@router.get(
    "/api/v1/wafers/{wafer_id}/steps", response_model=list[ProcessStepRead]
)
def list_steps(wafer_id: str, db: Session = Depends(get_db)):
    return crud.list_steps_for_wafer(db, wafer_id)


@router.get("/api/v1/steps/{step_id}", response_model=ProcessStepRead)
def get_step(step_id: str, db: Session = Depends(get_db)):
    step = crud.get_step(db, step_id)
    if not step:
        raise HTTPException(404, "Step not found")
    return step


@router.patch("/api/v1/steps/{step_id}", response_model=ProcessStepRead)
def update_step(step_id: str, data: ProcessStepUpdate, db: Session = Depends(get_db)):
    step = crud.get_step(db, step_id)
    if not step:
        raise HTTPException(404, "Step not found")
    return crud.update_step(db, step, data)


@router.delete("/api/v1/steps/{step_id}", status_code=204)
def delete_step(step_id: str, db: Session = Depends(get_db)):
    step = crud.get_step(db, step_id)
    if not step:
        raise HTTPException(404, "Step not found")
    crud.delete_step(db, step)
