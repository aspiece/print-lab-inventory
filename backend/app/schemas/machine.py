from pydantic import BaseModel, Field


class MachineCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    status: str = Field(default="offline", min_length=1, max_length=20)


class MachineOut(BaseModel):
    id: int
    name: str
    status: str
    current_spool_id: int | None = None
    current_spool_material_name: str | None = None
    current_spool_available: float | None = None
