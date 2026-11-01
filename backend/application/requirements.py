import json

from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database.models import Project, RawRequirement, TraceLink, UserStory
from schemas.requirement import RequirementRecord, RequirementUpdate, UserStoryRecord
from services.entity_revision import record_entity_revision


class RequirementNotFoundError(Exception):
    pass


class RequirementConflictError(Exception):
    pass


class RequirementPersistenceError(Exception):
    pass


class RequirementDataError(Exception):
    pass


def serialize_content(data: RequirementUpdate) -> str:
    return json.dumps(
        {
            "actor": data.actor,
            "action": data.action,
            "target_object": data.target_object,
            "purpose": data.purpose,
            "pre_conditions": data.pre_conditions,
            "business_rules": data.business_rules,
        },
        ensure_ascii=False,
    )


def deserialize_content(requirement: RawRequirement) -> dict:
    from pydantic import ValidationError

    try:
        content = json.loads(requirement.content)
    except (TypeError, json.JSONDecodeError) as exc:
        raise RequirementDataError("Nội dung yêu cầu trong cơ sở dữ liệu không hợp lệ.") from exc
    if not isinstance(content, dict):
        raise RequirementDataError("Nội dung yêu cầu trong cơ sở dữ liệu không hợp lệ.")
    try:
        return RequirementUpdate.model_validate(content).model_dump()
    except ValidationError as exc:
        raise RequirementDataError(
            "Nội dung yêu cầu trong cơ sở dữ liệu thiếu hoặc sai trường bắt buộc."
        ) from exc


def get_project(db: Session, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is None:
        raise RequirementNotFoundError("Không tìm thấy dự án.")
    return project


def get_requirement(db: Session, requirement_id: int) -> RawRequirement:
    requirement = (
        db.query(RawRequirement)
        .filter(RawRequirement.id == requirement_id)
        .first()
    )
    if requirement is None:
        raise RequirementNotFoundError("Không tìm thấy yêu cầu.")
    return requirement


def _to_record(db: Session, requirement: RawRequirement) -> RequirementRecord:
    story = (
        db.query(UserStory)
        .filter(UserStory.requirement_id == requirement.id)
        .order_by(UserStory.id.desc())
        .first()
    )
    return RequirementRecord(
        id=requirement.id,
        public_id=requirement.public_id,
        project_id=requirement.project_id,
        content=requirement.content,
        status=requirement.status,
        user_story=UserStoryRecord.model_validate(story) if story else None,
    )


def list_requirements(db: Session, project_id: int) -> list[RequirementRecord]:
    get_project(db, project_id)
    records = (
        db.query(RawRequirement)
        .filter(RawRequirement.project_id == project_id)
        .order_by(RawRequirement.id.asc())
        .all()
    )
    return [_to_record(db, item) for item in records]


def get_requirement_record(db: Session, requirement_id: int) -> RequirementRecord:
    return _to_record(db, get_requirement(db, requirement_id))


def create_requirement(
    db: Session,
    *,
    project_id: int,
    data: RequirementUpdate,
    user_id: int,
) -> RawRequirement:
    get_project(db, project_id)
    requirement = RawRequirement(
        project_id=project_id,
        content=serialize_content(data),
        status="draft",
    )
    try:
        db.add(requirement)
        db.flush()
        record_entity_revision(
            db,
            project_id=requirement.project_id,
            entity_type="requirement",
            entity_id=requirement.id,
            content={
                "content": deserialize_content(requirement),
                "status": requirement.status,
            },
            change_type="create",
            change_note="Tạo yêu cầu",
            created_by=user_id,
        )
        db.commit()
        db.refresh(requirement)
        return requirement
    except SQLAlchemyError as exc:
        db.rollback()
        raise RequirementPersistenceError("Không thể lưu yêu cầu.") from exc


def update_requirement(
    db: Session,
    *,
    requirement_id: int,
    data: RequirementUpdate,
    user_id: int,
) -> RawRequirement:
    requirement = get_requirement(db, requirement_id)
    if requirement.status != "draft":
        raise RequirementConflictError("Yêu cầu đã xác nhận, không thể sửa.")
    requirement.content = serialize_content(data)
    try:
        record_entity_revision(
            db,
            project_id=requirement.project_id,
            entity_type="requirement",
            entity_id=requirement.id,
            content={
                "content": deserialize_content(requirement),
                "status": requirement.status,
            },
            change_type="update",
            change_note="Cập nhật yêu cầu",
            created_by=user_id,
        )
        db.commit()
        db.refresh(requirement)
        return requirement
    except SQLAlchemyError as exc:
        db.rollback()
        raise RequirementPersistenceError("Không thể cập nhật yêu cầu.") from exc


def delete_requirement(
    db: Session,
    *,
    requirement_id: int,
    user_id: int,
) -> None:
    requirement = get_requirement(db, requirement_id)
    if requirement.status != "draft":
        raise RequirementConflictError("Chỉ được xóa yêu cầu ở trạng thái draft.")
    if db.query(UserStory.id).filter(
        UserStory.requirement_id == requirement_id
    ).first():
        raise RequirementConflictError(
            "Không thể xóa yêu cầu đang được tham chiếu bởi user story."
        )
    try:
        record_entity_revision(
            db,
            project_id=requirement.project_id,
            entity_type="requirement",
            entity_id=requirement.id,
            content={"content": requirement.content, "status": requirement.status},
            change_type="delete",
            change_note="Xóa yêu cầu nháp",
            created_by=user_id,
        )
        db.query(TraceLink).filter(
            or_(
                (
                    TraceLink.source_type.in_(("requirement", "raw_requirement"))
                ) & (TraceLink.source_id == requirement_id),
                (
                    TraceLink.target_type.in_(("requirement", "raw_requirement"))
                ) & (TraceLink.target_id == requirement_id),
            )
        ).delete(synchronize_session=False)
        db.delete(requirement)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise RequirementPersistenceError("Không thể xóa yêu cầu.") from exc
