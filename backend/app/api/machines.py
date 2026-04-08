from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.crud import machine as crud
from app.schemas.machine import MachineCreate, MachineParameterDefinitionRead, MachineRead

router = APIRouter(prefix="/api/v1/machines", tags=["machines"])


@router.get("", response_model=list[MachineRead])
def list_machines(db: Session = Depends(get_db)):
    return crud.list_machines(db)


@router.get(
    "/{machine_id}/parameter-definitions",
    response_model=list[MachineParameterDefinitionRead],
)
def get_param_defs(machine_id: str, db: Session = Depends(get_db)):
    machine = crud.get_machine_with_params(db, machine_id)
    if not machine:
        raise HTTPException(404, "Machine not found")
    return machine.parameter_definitions


@router.post("", response_model=MachineRead, status_code=201)
def create_machine(data: MachineCreate, db: Session = Depends(get_db)):
    return crud.create_machine(db, data)
