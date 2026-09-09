from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import InventoryEvent, InventoryEventType, Machine, Material, ReservationEvent, Spool
from app.schemas.spool import (
    InventoryEventOut,
    ReservationEventOut,
    SpoolAssignmentCreate,
    SpoolCorrectionCreate,
    SpoolCreate,
    SpoolDetailOut,
    SpoolOut,
    SpoolUnassignCreate,
    SpoolWeightUpdate,
)
from app.services.inventory import (
    assign_to_machine,
    get_current_machine,
    get_current_weight,
    record_correction,
    record_filament_used,
    record_weight_adjustment,
    remove_from_machine,
)
from app.services.reservations import get_available, get_reserved_amount

router = APIRouter()


def _to_iso(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _build_spool_out(db: Session, spool: Spool, material: Material) -> SpoolOut:
    return SpoolOut(
        id=spool.id,
        material_id=spool.material_id,
        material_name=material.name,
        material_color=material.color,
        original_filament_weight=float(spool.original_weight),
        empty_spool_weight=float(spool.empty_spool_weight),
        low_stock_threshold=float(spool.low_stock_threshold),
        current_weight=get_current_weight(db, spool.id),
        current_machine_id=get_current_machine(db, spool.id),
        reserved_amount=get_reserved_amount(db, spool.id),
        available=get_available(db, spool.id),
    )


def _get_spool_or_404(db: Session, spool_id: int) -> Spool:
    spool = db.get(Spool, spool_id)
    if spool is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Spool not found.")
    return spool


@router.post("", response_model=SpoolOut, status_code=status.HTTP_201_CREATED)
def create_spool(payload: SpoolCreate, db: Session = Depends(get_db)) -> SpoolOut:
    material = db.get(Material, payload.material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found.")

    spool = Spool(
        material_id=payload.material_id,
        original_weight=int(payload.original_filament_weight),
        empty_spool_weight=int(payload.empty_spool_weight),
        low_stock_threshold=int(payload.low_stock_threshold),
    )
    db.add(spool)
    db.flush()

    creation_event = InventoryEvent(
        spool_id=spool.id,
        event_type=InventoryEventType.SPOOL_CREATED,
        quantity_change=payload.original_filament_weight,
        user_id=payload.user_id,
        note="Initial spool creation",
    )
    db.add(creation_event)
    db.commit()
    db.refresh(spool)
    return _build_spool_out(db, spool, material)


@router.get("", response_model=list[SpoolOut])
def list_spools(db: Session = Depends(get_db)) -> list[SpoolOut]:
    spools = db.query(Spool).order_by(Spool.id.desc()).all()
    if not spools:
        return []

    material_ids = {spool.material_id for spool in spools}
    materials = {
        material.id: material
        for material in db.query(Material).filter(Material.id.in_(material_ids)).all()
    }
    return [
        _build_spool_out(db, spool, materials[spool.material_id])
        for spool in spools
        if spool.material_id in materials
    ]


@router.get("/{spool_id}", response_model=SpoolDetailOut)
def get_spool(spool_id: int, db: Session = Depends(get_db)) -> SpoolDetailOut:
    spool = _get_spool_or_404(db, spool_id)
    material = db.get(Material, spool.material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Material missing for spool.")

    inventory_history = (
        db.query(InventoryEvent)
        .filter(InventoryEvent.spool_id == spool_id)
        .order_by(InventoryEvent.created_at.desc(), InventoryEvent.id.desc())
        .all()
    )
    reservation_history = (
        db.query(ReservationEvent)
        .filter(ReservationEvent.spool_id == spool_id)
        .order_by(ReservationEvent.created_at.desc(), ReservationEvent.id.desc())
        .all()
    )

    spool_out = _build_spool_out(db, spool, material)
    return SpoolDetailOut(
        **spool_out.model_dump(),
        inventory_history=[
            InventoryEventOut(
                id=event.id,
                spool_id=event.spool_id,
                event_type=event.event_type.value,
                quantity_change=event.quantity_change,
                machine_id=event.machine_id,
                user_id=event.user_id,
                related_event_id=event.related_event_id,
                related_request_id=event.related_request_id,
                note=event.note,
                created_at=_to_iso(event.created_at),
            )
            for event in inventory_history
        ],
        reservation_history=[
            ReservationEventOut(
                id=event.id,
                spool_id=event.spool_id,
                print_request_id=event.print_request_id,
                event_type=event.event_type.value,
                amount=event.amount,
                user_id=event.user_id,
                related_event_id=event.related_event_id,
                created_at=_to_iso(event.created_at),
            )
            for event in reservation_history
        ],
    )


@router.post("/{spool_id}/weight", response_model=SpoolDetailOut)
def update_weight(
    spool_id: int, payload: SpoolWeightUpdate, db: Session = Depends(get_db)
) -> SpoolDetailOut:
    _get_spool_or_404(db, spool_id)

    try:
        if payload.mode == "use_filament":
            assert payload.amount is not None
            record_filament_used(db, spool_id, payload.amount, payload.user_id)
        else:
            assert payload.new_total_weight is not None
            record_weight_adjustment(db, spool_id, payload.new_total_weight, payload.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return get_spool(spool_id, db)


@router.post("/{spool_id}/correct", response_model=SpoolDetailOut)
def correct_event(
    spool_id: int, payload: SpoolCorrectionCreate, db: Session = Depends(get_db)
) -> SpoolDetailOut:
    _get_spool_or_404(db, spool_id)

    try:
        record_correction(
            db,
            related_event_id=payload.related_event_id,
            amount=payload.amount,
            reason=payload.reason,
            user_id=payload.user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return get_spool(spool_id, db)


@router.post("/{spool_id}/assign", response_model=SpoolDetailOut)
def assign_spool(
    spool_id: int, payload: SpoolAssignmentCreate, db: Session = Depends(get_db)
) -> SpoolDetailOut:
    _get_spool_or_404(db, spool_id)
    if db.get(Machine, payload.machine_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found.")

    try:
        assign_to_machine(db, spool_id, payload.machine_id, payload.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return get_spool(spool_id, db)


@router.post("/{spool_id}/unassign", response_model=SpoolDetailOut)
def unassign_spool(
    spool_id: int, payload: SpoolUnassignCreate, db: Session = Depends(get_db)
) -> SpoolDetailOut:
    _get_spool_or_404(db, spool_id)

    try:
        remove_from_machine(db, spool_id, payload.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return get_spool(spool_id, db)
