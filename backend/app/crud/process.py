from __future__ import annotations

import uuid

from sqlalchemy.orm import Session, selectinload

from app.models import ProcessRun, ProcessStep, StepParameterValue
from app.schemas.process import BatchStepCreate, ProcessStepCreate, ProcessStepUpdate


def list_steps_for_wafer(db: Session, wafer_uuid: str) -> list[ProcessStep]:
    return (
        db.query(ProcessStep)
        .options(selectinload(ProcessStep.parameter_values))
        .filter(ProcessStep.wafer_id == uuid.UUID(wafer_uuid))
        .order_by(ProcessStep.step_number, ProcessStep.timestamp_start)
        .all()
    )


def get_step(db: Session, step_uuid: str) -> ProcessStep | None:
    return (
        db.query(ProcessStep)
        .options(selectinload(ProcessStep.parameter_values))
        .filter(ProcessStep.id == uuid.UUID(step_uuid))
        .first()
    )


def create_step(db: Session, data: ProcessStepCreate) -> ProcessStep:
    param_data = data.parameter_values
    step_dict = data.model_dump(exclude={"parameter_values"})
    step = ProcessStep(**step_dict)
    db.add(step)
    db.flush()

    for pv in param_data:
        spv = StepParameterValue(step_id=step.id, **pv.model_dump())
        db.add(spv)

    db.commit()
    db.refresh(step)
    return step


def update_step(db: Session, step: ProcessStep, data: ProcessStepUpdate) -> ProcessStep:
    update_data = data.model_dump(exclude_unset=True)
    param_data = update_data.pop("parameter_values", None)

    for field, value in update_data.items():
        setattr(step, field, value)

    if param_data is not None:
        # Replace all parameter values
        for pv in step.parameter_values:
            db.delete(pv)
        db.flush()
        for pv in param_data:
            spv = StepParameterValue(step_id=step.id, **pv)
            db.add(spv)

    db.commit()
    db.refresh(step)
    return step


def create_batch_steps(db: Session, data: BatchStepCreate) -> ProcessRun:
    run = ProcessRun(
        run_label=data.run_label,
        machine_id=data.machine_id,
        category=data.category,
        timestamp_start=data.timestamp_start,
        timestamp_end=data.timestamp_end,
        notes=data.notes,
    )
    db.add(run)
    db.flush()

    for wafer_id in data.wafer_ids:
        step = ProcessStep(
            wafer_id=wafer_id,
            run_id=run.id,
            name=data.name,
            category=data.category,
            timestamp_start=data.timestamp_start,
            timestamp_end=data.timestamp_end,
            machine_id=data.machine_id,
            step_number=data.step_number,
            status=data.status,
            notes=data.notes,
        )
        db.add(step)
        db.flush()

        for pv in data.parameter_values:
            spv = StepParameterValue(step_id=step.id, **pv.model_dump())
            db.add(spv)

    db.commit()
    db.refresh(run)
    return run


def delete_step(db: Session, step: ProcessStep) -> None:
    db.delete(step)
    db.commit()
