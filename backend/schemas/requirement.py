from pydantic import BaseModel, Field
from typing import Optional

class RequirementSchema(BaseModel):
    project_id: int
    actor: str = Field(..., min_length=1)
    feature: str = Field(..., min_length=1)
    benefit: str = Field(..., min_length=1)
    precondition: Optional[str] = None
    constraint: Optional[str] = None