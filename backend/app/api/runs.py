from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import process as crud
from app.schemas.process import BatchStepCreate, ProcessRunRead

router = APIRouter(prefix="/api/v1/runs", tags=["runs"])


@router.post("/batch", response_model=ProcessRunRead, status_code=201)
def create_batch_steps(data: BatchStepCreate, db: Session = Depends(get_db)):
    return crud.create_batch_steps(db, data)
