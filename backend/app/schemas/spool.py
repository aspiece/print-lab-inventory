from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SpoolCreate(BaseModel):
    material_id: int = Field(gt=0)
    original_filament_weight: float = Field(gt=0)
    empty_spool_weight: float = Field(ge=0)
    low_stock_threshold: float = Field(ge=0)
    user_id: str = Field(min_length=1, max_length=100)


class SpoolWeightUpdate(BaseModel):
    mode: Literal["use_filament", "set_total_weight"]
    user_id: str = Field(min_length=1, max_length=100)
    amount: float | None = Field(default=None, gt=0)
    new_total_weight: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_payload(self) -> "SpoolWeightUpdate":
        if self.mode == "use_filament" and self.amount is None:
            raise ValueError("amount is required when mode is 'use_filament'")
        if self.mode == "set_total_weight" and self.new_total_weight is None:
            raise ValueError(
                "new_total_weight is required when mode is 'set_total_weight'"
            )
        return self


class SpoolCorrectionCreate(BaseModel):
    related_event_id: int = Field(gt=0)
    amount: float
    reason: str = Field(min_length=1, max_length=500)
    user_id: str = Field(min_length=1, max_length=100)


class SpoolAssignmentCreate(BaseModel):
    machine_id: int = Field(gt=0)
    user_id: str = Field(min_length=1, max_length=100)


class SpoolUnassignCreate(BaseModel):
    user_id: str = Field(min_length=1, max_length=100)


class InventoryEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    spool_id: int
    event_type: str
    quantity_change: float | None
    machine_id: int | None
    user_id: str
    related_event_id: int | None
    related_request_id: int | None
    note: str | None
    created_at: str


class ReservationEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    spool_id: int
    print_request_id: int
    event_type: str
    amount: float
    user_id: str
    related_event_id: int | None
    created_at: str


class SpoolOut(BaseModel):
    id: int
    material_id: int
    material_name: str
    material_color: str | None = None
    original_filament_weight: float
    empty_spool_weight: float
    low_stock_threshold: float
    current_weight: float
    current_machine_id: int | None
    reserved_amount: float
    available: float


class SpoolDetailOut(SpoolOut):
    inventory_history: list[InventoryEventOut]
    reservation_history: list[ReservationEventOut]
