from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from application.projects import (
    ProjectApplicationError,
    ProjectNotFoundError,
    create_project as create_project_use_case,
    delete_project as delete_project_use_case,
    list_projects as list_projects_use_case,
)
from database.db import get_db
from database.models import User
from routers.auth import get_current_user
from schemas.project import ProjectCreate, ProjectRecord

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRecord])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProjectRecord]:
    try:
        projects = list_projects_use_case(db, current_user.id)
        return [ProjectRecord.model_validate(project) for project in projects]
    except ProjectApplicationError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("", response_model=ProjectRecord, status_code=201)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectRecord:
    try:
        project = create_project_use_case(
            db,
            user_id=current_user.id,
            name=data.name,
        )
        return ProjectRecord.model_validate(project)
    except ProjectApplicationError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    try:
        delete_project_use_case(
            db,
            project_id=project_id,
            user_id=current_user.id,
        )
    except ProjectNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy dự án hoặc bạn không có quyền truy cập.",
        ) from exc
    except ProjectApplicationError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
