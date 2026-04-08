from __future__ import annotations

import uuid

from sqlalchemy.orm import Session, selectinload

from app.models import Machine, MachineParameterDefinition
from app.schemas.machine import MachineCreate


def list_machines(db: Session) -> list[Machine]:
    return (
        db.query(Machine)
        .filter(Machine.is_active == True)  # noqa: E712
        .order_by(Machine.name)
        .all()
    )


def get_machine_with_params(db: Session, machine_uuid: str) -> Machine | None:
    return (
        db.query(Machine)
        .options(selectinload(Machine.parameter_definitions))
        .filter(Machine.id == uuid.UUID(machine_uuid))
        .first()
    )


def create_machine(db: Session, data: MachineCreate) -> Machine:
    param_defs_data = data.parameter_definitions
    machine_dict = data.model_dump(exclude={"parameter_definitions"})
    machine = Machine(**machine_dict)
    db.add(machine)
    db.flush()

    for i, pd in enumerate(param_defs_data):
        defn = MachineParameterDefinition(
            machine_id=machine.id,
            **pd.model_dump(),
        )
        if defn.sort_order == 0:
            defn.sort_order = i
        db.add(defn)

    db.commit()
    db.refresh(machine)
    return machine
