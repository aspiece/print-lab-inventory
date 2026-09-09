from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Machine, Material, Spool
from app.schemas.machine import MachineCreate, MachineOut
from app.services.inventory import get_current_machine
from app.services.reservations import get_available

router = APIRouter()


def _build_machine_out(
    machine: Machine,
    assigned_spool: Spool | None,
    material: Material | None,
    available: float | None,
) -> MachineOut:
    return MachineOut(
        id=machine.id,
        name=machine.name,
        status=machine.status,
        current_spool_id=assigned_spool.id if assigned_spool else None,
        current_spool_material_name=material.name if material else None,
        current_spool_available=available,
    )


@router.post("", response_model=MachineOut, status_code=status.HTTP_201_CREATED)
def create_machine(payload: MachineCreate, db: Session = Depends(get_db)) -> MachineOut:
    machine = Machine(name=payload.name, status=payload.status)
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return _build_machine_out(machine, None, None, None)


@router.get("", response_model=list[MachineOut])
def list_machines(db: Session = Depends(get_db)) -> list[MachineOut]:
    machines = db.query(Machine).order_by(Machine.name.asc(), Machine.id.asc()).all()
    if not machines:
        return []

    spools = db.query(Spool).all()
    assigned_by_machine = {}
    material_ids = set()
    for spool in spools:
        machine_id = get_current_machine(db, spool.id)
        if machine_id is not None:
            assigned_by_machine[machine_id] = spool
            material_ids.add(spool.material_id)

    materials = {
        material.id: material
        for material in db.query(Material).filter(Material.id.in_(material_ids)).all()
    } if material_ids else {}

    result = []
    for machine in machines:
        assigned_spool = assigned_by_machine.get(machine.id)
        material = materials.get(assigned_spool.material_id) if assigned_spool else None
        available = get_available(db, assigned_spool.id) if assigned_spool else None
        result.append(_build_machine_out(machine, assigned_spool, material, available))
    return result
