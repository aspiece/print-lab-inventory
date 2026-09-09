from pydantic import BaseModel, Field


class PrintRequestCreate(BaseModel):
    requested_by: str = Field(min_length=1, max_length=100)
    project_name: str = Field(min_length=1, max_length=200)
    material_id: int = Field(gt=0)
    amount_required: float = Field(gt=0)


class ReservationCreate(BaseModel):
    user_id: str = Field(min_length=1, max_length=100)
    spool_id: int | None = Field(default=None, gt=0)


class ReservationAction(BaseModel):
    user_id: str = Field(min_length=1, max_length=100)
    reservation_id: int | None = Field(default=None, gt=0)


class PrintRequestOut(BaseModel):
    id: int
    requested_by: str
    project_name: str
    material_id: int
    material_name: str
    material_color: str | None = None
    amount_required: float
    status: str
    active_reservation_id: int | None = None
    active_reserved_amount: float | None = None
    reserved_spool_id: int | None = None
    reservation_status: str | None = None
