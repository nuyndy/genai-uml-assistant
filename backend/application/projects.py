import logging

from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database.models import (
    Actor,
    ClassEntity,
    ClassRelation,
    Diagram,
    DiagramRevision,
    EntityRevision,
    GlossaryTerm,
    Project,
    ProjectBaseline,
    RawRequirement,
    Specification,
    SpecificationApproval,
    SrsDocument,
    TraceLink,
    UcActorRelation,
    UseCase,
    UserStory,
)

logger = logging.getLogger(__name__)


class ProjectNotFoundError(Exception):
    """Raised when a project does not exist or is not owned by the caller."""


class ProjectApplicationError(Exception):
    """Raised when a project use case cannot be completed."""


def list_projects(db: Session, user_id: int) -> list[Project]:
    try:
        return (
            db.query(Project)
            .filter(Project.user_id == user_id)
            .order_by(Project.id.asc())
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not list projects")
        raise ProjectApplicationError("Không thể đọc dự án.") from exc


def create_project(db: Session, *, user_id: int, name: str) -> Project:
    project = Project(name=name, user_id=user_id)
    try:
        db.add(project)
        db.commit()
        db.refresh(project)
        return project
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not create project")
        raise ProjectApplicationError("Không thể tạo dự án.") from exc


def delete_project(db: Session, *, project_id: int, user_id: int) -> None:
    try:
        project = (
            db.query(Project)
            .filter(Project.id == project_id, Project.user_id == user_id)
            .first()
        )
        if project is None:
            raise ProjectNotFoundError

        requirement_ids = [
            row[0]
            for row in db.query(RawRequirement.id)
            .filter(RawRequirement.project_id == project_id)
            .all()
        ]
        story_ids = (
            [
                row[0]
                for row in db.query(UserStory.id)
                .filter(UserStory.requirement_id.in_(requirement_ids))
                .all()
            ]
            if requirement_ids
            else []
        )

        specification_query = db.query(Specification.id).filter(
            Specification.project_id == project_id
        )
        if story_ids:
            specification_query = specification_query.union(
                db.query(Specification.id).filter(
                    Specification.user_story_id.in_(story_ids)
                )
            )
        specification_ids = [row[0] for row in specification_query.all()]
        use_case_ids = (
            [
                row[0]
                for row in db.query(UseCase.id)
                .filter(UseCase.specification_id.in_(specification_ids))
                .all()
            ]
            if specification_ids
            else []
        )
        class_ids = [
            row[0]
            for row in db.query(ClassEntity.id)
            .filter(ClassEntity.project_id == project_id)
            .all()
        ]

        db.query(DiagramRevision).filter(
            DiagramRevision.diagram_id.in_(
                db.query(Diagram.id).filter(Diagram.project_id == project_id)
            )
        ).delete(synchronize_session=False)
        db.query(TraceLink).filter(
            TraceLink.project_id == project_id
        ).delete(synchronize_session=False)
        db.query(ProjectBaseline).filter(
            ProjectBaseline.project_id == project_id
        ).delete(synchronize_session=False)
        db.query(GlossaryTerm).filter(
            GlossaryTerm.project_id == project_id
        ).delete(synchronize_session=False)
        db.query(EntityRevision).filter(
            EntityRevision.project_id == project_id
        ).delete(synchronize_session=False)
        if specification_ids:
            db.query(SpecificationApproval).filter(
                SpecificationApproval.specification_id.in_(specification_ids)
            ).delete(synchronize_session=False)
        db.query(Diagram).filter(Diagram.project_id == project_id).delete(
            synchronize_session=False
        )
        db.query(SrsDocument).filter(SrsDocument.project_id == project_id).delete(
            synchronize_session=False
        )
        if use_case_ids:
            db.query(UcActorRelation).filter(
                UcActorRelation.use_case_id.in_(use_case_ids)
            ).delete(synchronize_session=False)
        if class_ids:
            db.query(ClassRelation).filter(
                or_(
                    ClassRelation.class_a_id.in_(class_ids),
                    ClassRelation.class_b_id.in_(class_ids),
                )
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
    except ProjectNotFoundError:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not delete project and its dependent records")
        raise ProjectApplicationError(
            "Không thể xóa dự án và dữ liệu liên quan."
        ) from exc
