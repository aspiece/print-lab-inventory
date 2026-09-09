from pydantic import BaseModel, ConfigDict, Field


class MaterialCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color: str | None = Field(default=None, max_length=50)


class MaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str | None
