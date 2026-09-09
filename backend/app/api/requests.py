from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Material, PrintRequest, PrintRequestStatus, ReservationEvent, ReservationEventType, Spool
from app.schemas.request import (
    PrintRequestCreate,
    PrintRequestOut,
    ReservationAction,
    ReservationCreate,
)
from app.services.reservations import (
    _get_reservation_status,
    create_reservation,
    fulfill_reservation,
    get_available,
    release_reservation,
)

router = APIRouter()


def _get_request_or_404(db: Session, request_id: int) -> PrintRequest:
    print_request = db.get(PrintRequest, request_id)
    if print_request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Print request not found.")
    return print_request


def _get_active_reservation_for_request(
    db: Session, request_id: int
) -> ReservationEvent | None:
    created_events = (
        db.query(ReservationEvent)
        .filter(
            ReservationEvent.print_request_id == request_id,
            ReservationEvent.event_type == ReservationEventType.RESERVATION_CREATED,
        )
        .order_by(ReservationEvent.created_at.desc(), ReservationEvent.id.desc())
        .all()
    )
    for event in created_events:
        if _get_reservation_status(db, event.id) == "active":
            return event
    return None


def _build_request_out(
    db: Session, print_request: PrintRequest, material: Material
) -> PrintRequestOut:
    active_reservation = _get_active_reservation_for_request(db, print_request.id)
    reservation_status = (
        _get_reservation_status(db, active_reservation.id) if active_reservation else None
    )
    return PrintRequestOut(
        id=print_request.id,
        requested_by=print_request.requested_by,
        project_name=print_request.project_name,
        material_id=print_request.material_id,
        material_name=material.name,
        material_color=material.color,
        amount_required=float(print_request.amount_grams),
        status=print_request.status.value,
        active_reservation_id=active_reservation.id if active_reservation else None,
        active_reserved_amount=active_reservation.amount if active_reservation else None,
        reserved_spool_id=active_reservation.spool_id if active_reservation else None,
        reservation_status=reservation_status,
    )


@router.post("", response_model=PrintRequestOut, status_code=status.HTTP_201_CREATED)
def create_request(
    payload: PrintRequestCreate, db: Session = Depends(get_db)
) -> PrintRequestOut:
    material = db.get(Material, payload.material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found.")

    print_request = PrintRequest(
        requested_by=payload.requested_by,
        project_name=payload.project_name,
        material_id=payload.material_id,
        amount_grams=int(payload.amount_required),
        status=PrintRequestStatus.PENDING,
    )
    db.add(print_request)
    db.commit()
    db.refresh(print_request)
    return _build_request_out(db, print_request, material)


@router.get("", response_model=list[PrintRequestOut])
def list_requests(db: Session = Depends(get_db)) -> list[PrintRequestOut]:
    requests = db.query(PrintRequest).order_by(PrintRequest.id.desc()).all()
    if not requests:
        return []

    material_ids = {request.material_id for request in requests}
    materials = {
        material.id: material
        for material in db.query(Material).filter(Material.id.in_(material_ids)).all()
    }
    return [
        _build_request_out(db, request, materials[request.material_id])
        for request in requests
        if request.material_id in materials
    ]


@router.post("/{request_id}/reserve", response_model=PrintRequestOut)
def reserve(
    request_id: int, payload: ReservationCreate, db: Session = Depends(get_db)
) -> PrintRequestOut:
    print_request = _get_request_or_404(db, request_id)
    material = db.get(Material, print_request.material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Material missing for print request.")

    if _get_active_reservation_for_request(db, request_id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This request already has an active reservation.",
        )

    selected_spool_id = payload.spool_id
    if selected_spool_id is None:
        candidate_spools = db.query(Spool).filter(Spool.material_id == print_request.material_id).all()
        compatible_spools = [
            spool for spool in candidate_spools if get_available(db, spool.id) >= print_request.amount_grams
        ]
        if not compatible_spools:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No compatible spool has enough available filament.",
            )
        selected_spool_id = max(
            compatible_spools,
            key=lambda spool: (get_available(db, spool.id), spool.id),
        ).id
    else:
        spool = db.get(Spool, selected_spool_id)
        if spool is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Spool not found.")
        if spool.material_id != print_request.material_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected spool does not match the request material.",
            )

    try:
        create_reservation(
            db,
            spool_id=selected_spool_id,
            print_request_id=print_request.id,
            amount=float(print_request.amount_grams),
            user_id=payload.user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    print_request.status = PrintRequestStatus.APPROVED
    db.add(print_request)
    db.commit()
    db.refresh(print_request)
    return _build_request_out(db, print_request, material)


def _resolve_reservation_id(
    db: Session, request_id: int, reservation_id: int | None
) -> int:
    if reservation_id is not None:
        return reservation_id

    active_reservation = _get_active_reservation_for_request(db, request_id)
    if active_reservation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active reservation found for this request.",
        )
    return active_reservation.id


@router.post("/{request_id}/release", response_model=PrintRequestOut)
def release(
    request_id: int, payload: ReservationAction, db: Session = Depends(get_db)
) -> PrintRequestOut:
    print_request = _get_request_or_404(db, request_id)
    material = db.get(Material, print_request.material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Material missing for print request.")

    reservation_id = _resolve_reservation_id(db, request_id, payload.reservation_id)
    try:
        release_reservation(db, reservation_id, payload.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    print_request.status = PrintRequestStatus.PENDING
    db.add(print_request)
    db.commit()
    db.refresh(print_request)
    return _build_request_out(db, print_request, material)


@router.post("/{request_id}/fulfill", response_model=PrintRequestOut)
def fulfill(
    request_id: int, payload: ReservationAction, db: Session = Depends(get_db)
) -> PrintRequestOut:
    print_request = _get_request_or_404(db, request_id)
    material = db.get(Material, print_request.material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Material missing for print request.")

    reservation_id = _resolve_reservation_id(db, request_id, payload.reservation_id)
    try:
        fulfill_reservation(db, reservation_id, payload.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    print_request.status = PrintRequestStatus.COMPLETE
    db.add(print_request)
    db.commit()
    db.refresh(print_request)
    return _build_request_out(db, print_request, material)
