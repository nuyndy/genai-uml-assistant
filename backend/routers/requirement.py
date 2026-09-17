from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database.db import get_db
from database.models import RawRequirement, User
from schemas.requirement import RequirementSchema
from routers.auth import get_current_user
import json
router = APIRouter()

@router.post("/api/requirements")
def create_requirement(
    data: RequirementSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content_json = json.dumps({
        "actor": data.actor,
        "feature": data.feature,
        "benefit": data.benefit,
        "precondition": data.precondition,
        "constraint": data.constraint
    }, ensure_ascii=False)

    new_req = RawRequirement(
        project_id=data.project_id,
        content=content_json,
        status="draft"
    )
    db.add(new_req)
    db.commit()
    db.refresh(new_req)
    return {"message": "Lưu thành công", "id": new_req.id}
