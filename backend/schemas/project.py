from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1)

    model_config = ConfigDict(str_strip_whitespace=True)


class ProjectRecord(BaseModel):
    id: int
    name: str
    created_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
