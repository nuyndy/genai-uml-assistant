import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import (
    Actor,
    ClassEntity,
    ClassRelation,
    Diagram,
    Project,
    RawRequirement,
    Specification,
    SrsDocument,
    UcActorRelation,
    UseCase,
    User,
    UserStory,
)
from routers.auth import get_current_user
from schemas.project import ProjectCreate, ProjectRecord

router = APIRouter(prefix="/api/projects", tags=["projects"])
logger = logging.getLogger(__name__)


@router.get("", response_model=list[ProjectRecord])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProjectRecord]:
    try:
        return (
            db.query(Project)
            .filter(Project.user_id == current_user.id)
            .order_by(Project.id.asc())
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not list projects")
        raise HTTPException(status_code=500, detail="Không thể đọc dự án.") from exc


@router.post("", response_model=ProjectRecord, status_code=201)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectRecord:
    project = Project(name=data.name, user_id=current_user.id)
    try:
        db.add(project)
        db.commit()
        db.refresh(project)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not create project")
        raise HTTPException(status_code=500, detail="Không thể tạo dự án.") from exc
    return ProjectRecord.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    try:
        project = (
            db.query(Project)
            .filter(Project.id == project_id, Project.user_id == current_user.id)
            .first()
        )
        if project is None:
            raise HTTPException(
                status_code=404,
                detail="Không tìm thấy dự án hoặc bạn không có quyền truy cập.",
            )

        requirement_ids = [
            row[0]
            for row in db.query(RawRequirement.id)
            .filter(RawRequirement.project_id == project_id)
            .all()
        ]
        story_ids = [
            row[0]
            for row in db.query(UserStory.id)
            .filter(UserStory.requirement_id.in_(requirement_ids))
            .all()
        ] if requirement_ids else []
        specification_ids = [
            row[0]
            for row in db.query(Specification.id)
            .filter(Specification.user_story_id.in_(story_ids))
            .all()
        ] if story_ids else []
        use_case_ids = [
            row[0]
            for row in db.query(UseCase.id)
            .filter(UseCase.specification_id.in_(specification_ids))
            .all()
        ] if specification_ids else []
        class_ids = [
            row[0]
            for row in db.query(ClassEntity.id)
            .filter(ClassEntity.project_id == project_id)
            .all()
        ]

        db.query(Diagram).filter(Diagram.project_id == project_id).delete(
            synchronize_session=False
        )
        db.query(SrsDocument).filter(SrsDocument.project_id == project_id).delete(
            synchronize_session=False
        )
        db.query(Specification).filter(Specification.project_id == project_id).delete(
            synchronize_session=False
        )
        if use_case_ids:
            db.query(UcActorRelation).filter(
                UcActorRelation.use_case_id.in_(use_case_ids)
            ).delete(synchronize_session=False)
        if class_ids:
            db.query(ClassRelation).filter(
                (ClassRelation.class_a_id.in_(class_ids))
                | (ClassRelation.class_b_id.in_(class_ids))
            ).delete(synchronize_session=False)
        if use_case_ids:
            db.query(UseCase).filter(UseCase.id.in_(use_case_ids)).delete(
                synchronize_session=False
            )
        if specification_ids:
            db.query(Specification).filter(
                Specification.id.in_(specification_ids)
            ).delete(synchronize_session=False)
        if story_ids:
            db.query(UserStory).filter(UserStory.id.in_(story_ids)).delete(
                synchronize_session=False
            )
        if requirement_ids:
            db.query(RawRequirement).filter(
                RawRequirement.id.in_(requirement_ids)
            ).delete(synchronize_session=False)
        db.query(Actor).filter(Actor.project_id == project_id).delete(
            synchronize_session=False
        )
        if class_ids:
            db.query(ClassEntity).filter(ClassEntity.id.in_(class_ids)).delete(
                synchronize_session=False
            )
        db.delete(project)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not delete project and its dependent records")
        raise HTTPException(
            status_code=500,
            detail="Không thể xóa dự án và dữ liệu liên quan.",
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
