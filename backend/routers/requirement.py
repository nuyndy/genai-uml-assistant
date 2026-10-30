import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import Project, RawRequirement, Specification, TraceLink, User, UserStory
from routers.auth import get_current_user
from routers.ownership import require_project_owner
from schemas.requirement import (
    ConfirmRequirementsBatch,
    RequirementBatchInput,
    RequirementAnalysis,
    RequirementBatchAnalysis,
    RequirementBatchAnalysisItem,
    RequirementCoverageAnalysis,
    RequirementInput,
    RequirementRecord,
    RequirementUpdate,
    UserStoryDraft,
    UserStoryDraftBatch,
    UserStoryDraftContent,
    UserStoryRecord,
    UserStoryUpdate,
)
from services.ollama import AIServiceError, generate_json
from services.requirement_prompts import build_user_story_prompt

router = APIRouter(
    tags=["requirements"],
    dependencies=[Depends(require_project_owner)],
)
logger = logging.getLogger(__name__)


def _require_project(db: Session, project_id: int) -> Project:
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
    except SQLAlchemyError as exc:
        logger.exception("Could not read project")
        raise HTTPException(status_code=500, detail="Không thể đọc dự án.") from exc
    if project is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")
    return project


def _content(data: RequirementInput | RequirementUpdate) -> str:
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


def _load_content(requirement: RawRequirement) -> dict:
    try:
        content = json.loads(requirement.content)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422, detail="Nội dung yêu cầu trong cơ sở dữ liệu không hợp lệ."
        ) from exc
    if not isinstance(content, dict):
        raise HTTPException(
            status_code=422, detail="Nội dung yêu cầu trong cơ sở dữ liệu không hợp lệ."
        )
    try:
        return RequirementUpdate.model_validate(content).model_dump()
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail="Nội dung yêu cầu trong cơ sở dữ liệu thiếu hoặc sai trường bắt buộc.",
        ) from exc


def _requirement(db: Session, requirement_id: int) -> RawRequirement:
    try:
        requirement = (
            db.query(RawRequirement)
            .filter(RawRequirement.id == requirement_id)
            .first()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not read requirement")
        raise HTTPException(status_code=500, detail="Không thể đọc yêu cầu.") from exc
    if requirement is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu.")
    return requirement


def _analyze_content(content: dict) -> RequirementAnalysis:
    from services.requirement_analysis_prompts import build_requirement_analysis_prompt

    prompt = build_requirement_analysis_prompt(content)
    try:
        return generate_json(prompt, RequirementAnalysis)
    except AIServiceError as exc:
        logger.exception("AI returned invalid requirement analysis")
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def _generate_user_story(content: dict, requirement_id: int) -> UserStoryDraft:
    prompt = build_user_story_prompt(content)
    try:
        draft = generate_json(prompt, UserStoryDraftContent)
    except AIServiceError as exc:
        logger.exception("AI returned invalid user story draft")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return UserStoryDraft(requirement_id=requirement_id, **draft.model_dump())

@router.post("/api/projects/{project_id}/requirements", status_code=201)
def create_requirement(
    project_id: int,
    data: RequirementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, int | str]:
    _require_project(db, project_id)
    requirement = RawRequirement(
        project_id=project_id,
        content=_content(data),
        status="draft",
    )
    try:
        db.add(requirement)
        db.flush()
        record_entity_revision(db, requirement, project_id=project_id, entity_type="raw_requirement", user_id=current_user.id, change_type="create", change_note="Tạo yêu cầu")
        db.commit()
        db.refresh(requirement)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not save requirement")
        raise HTTPException(status_code=500, detail="Không thể lưu yêu cầu.") from exc
    return {"id": requirement.id, "status": requirement.status}


@router.post(
    "/api/projects/{project_id}/requirements/coverage-check",
    response_model=RequirementCoverageAnalysis,
)
def check_project_requirement_coverage(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> RequirementCoverageAnalysis:
    project = _require_project(db, project_id)
    try:
        requirements = (
            db.query(RawRequirement)
            .filter(RawRequirement.project_id == project_id)
            .order_by(RawRequirement.id)
            .all()
        )
        items = [_load_content(item) for item in requirements]
    except SQLAlchemyError as exc:
        logger.exception("Could not read project requirements for coverage check")
        raise HTTPException(
            status_code=500, detail="Không thể đọc yêu cầu để kiểm tra mức bao phủ."
        ) from exc
    try:
        stories = (
            db.query(UserStory)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .filter(RawRequirement.project_id == project_id)
            .order_by(UserStory.id.asc())
            .all()
        )
        specifications = (
            db.query(Specification, UserStory.feature)
            .outerjoin(UserStory, Specification.user_story_id == UserStory.id)
            .filter(
                or_(
                    Specification.project_id == project_id,
                    UserStory.requirement_id.in_(
                        db.query(RawRequirement.id).filter(
                            RawRequirement.project_id == project_id
                        )
                    ),
                )
            )
            .order_by(Specification.id.asc())
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not read stories/specifications for coverage check")
        raise HTTPException(
            status_code=500, detail="Không thể đọc User Story và đặc tả để kiểm tra độ bao phủ."
        ) from exc

    story_items = [
        {
            "role": story.role or "",
            "feature": story.feature,
            "benefit": story.benefit or "",
            "acceptance_criteria": story.acceptance_criteria or "",
        }
        for story in stories
    ]
    specification_items = [
        {
            "type": spec.type,
            "feature": feature or "Đặc tả phi chức năng",
            "content": spec.content,
        }
        for spec, feature in specifications
    ]
    prompt = (
        "Bạn là chuyên gia phân tích yêu cầu và thiết kế phần mềm. Hãy rà soát độ bao phủ "
        "chức năng của hệ thống bằng cách đối chiếu TẤT CẢ yêu cầu gốc, User Story và đặc tả "
        "đã có. Không chỉ nhắc lại các yêu cầu: hãy kiểm tra các nhóm nghiệp vụ thường bị "
        "bỏ sót nhưng có liên quan trực tiếp đến mục tiêu hệ thống, ví dụ quản lý dữ liệu, "
        "tìm kiếm/lọc, xác thực và phân quyền, kiểm tra dữ liệu đầu vào, trạng thái và vòng "
        "đời xử lý, thông báo, lịch sử/audit, báo cáo/xuất dữ liệu, xử lý lỗi và cấu hình. "
        "Đây chỉ là danh sách kiểm tra, KHÔNG mặc định rằng mọi nhóm đều cần có. Chỉ đề xuất "
        "nhóm phù hợp với tên hệ thống và bằng chứng trong dữ liệu. So sánh theo ý nghĩa "
        "nghiệp vụ, không chỉ so khớp từ khóa; không đề xuất chức năng đã được bao phủ bởi "
        "yêu cầu, User Story hoặc đặc tả khác. Nếu một chức năng có vẻ hữu ích nhưng chưa đủ "
        "căn cứ, vẫn có thể nêu như gợi ý cần người dùng xác nhận, và ghi rõ giả định trong "
        "reason; tuyệt đối không tự thêm quy tắc nghiệp vụ vào dữ liệu đã lưu. Tối đa 10 gợi ý. "
        "Nếu thực sự không tìm thấy điểm thiếu, trả suggestions rỗng và giải thích ngắn gọn. "
        "Trả về duy nhất JSON hợp lệ theo cấu trúc "
        '{"is_sufficient": boolean, "summary": string, "suggestions": '
        '[{"actor": string, "action": string, "target_object": string, '
        '"purpose": string, "pre_conditions": [string], "business_rules": [string], '
        '"reason": string}]}. Mỗi gợi ý phải có actor, action, target_object, purpose cụ thể. '
        "Mọi đề xuất chỉ là gợi ý, chưa được lưu cho đến khi người dùng chọn.\n\n"
        f"Tên hệ thống: {project.name}\n"
        f"Yêu cầu gốc: {json.dumps(items, ensure_ascii=False)}\n"
        f"User Story hiện có: {json.dumps(story_items, ensure_ascii=False)}\n"
        f"Đặc tả hiện có: {json.dumps(specification_items, ensure_ascii=False)}"
    )
    try:
        return generate_json(prompt, RequirementCoverageAnalysis)
    except AIServiceError as exc:
        logger.exception("AI returned invalid project requirement coverage analysis")
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post(
    "/api/projects/{project_id}/requirements/batch",
    response_model=list[RequirementRecord],
    status_code=201,
)
def create_project_requirements_batch(
    project_id: int,
    data: RequirementBatchInput,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[RequirementRecord]:
    _require_project(db, project_id)
    records = [
        RawRequirement(
            project_id=project_id,
            content=_content(requirement),
            status="draft",
        )
        for requirement in data.requirements
    ]
    try:
        db.add_all(records)
        db.commit()
        for record in records:
            db.refresh(record)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not save selected requirement coverage suggestions")
        raise HTTPException(
            status_code=500, detail="Không thể lưu các yêu cầu đã chọn."
        ) from exc
    return [
        RequirementRecord(
            id=record.id,
            project_id=record.project_id,
            content=record.content,
            status=record.status,
            user_story=None,
        )
        for record in records
    ]


@router.get("/api/projects/{project_id}/requirements", response_model=list[RequirementRecord])
def list_project_requirements(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[RequirementRecord]:
    _require_project(db, project_id)
    try:
        requirements = (
            db.query(RawRequirement)
            .filter(RawRequirement.project_id == project_id)
            .order_by(RawRequirement.id.asc())
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not read project requirements")
        raise HTTPException(
            status_code=500, detail="Không thể đọc yêu cầu của dự án."
        ) from exc
    try:
        return [
            RequirementRecord(
                id=requirement.id,
                project_id=requirement.project_id,
                content=requirement.content,
                status=requirement.status,
                user_story=UserStoryRecord.model_validate(story) if story else None,
            )
            for requirement in requirements
            for story in [
                db.query(UserStory)
                .filter(UserStory.requirement_id == requirement.id)
                .order_by(UserStory.id.desc())
                .first()
            ]
        ]
    except SQLAlchemyError as exc:
        logger.exception("Could not read project requirement user stories")
        raise HTTPException(status_code=500, detail="Không thể đọc user story của yêu cầu.") from exc


@router.get("/api/requirements/{requirement_id}", response_model=RequirementRecord)
def get_requirement(
    requirement_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> RequirementRecord:
    requirement = _requirement(db, requirement_id)
    try:
        story = (
            db.query(UserStory)
            .filter(UserStory.requirement_id == requirement.id)
            .order_by(UserStory.id.desc())
            .first()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not read requirement user story")
        raise HTTPException(status_code=500, detail="Không thể đọc user story.") from exc
    return RequirementRecord(
        id=requirement.id,
        project_id=requirement.project_id,
        content=requirement.content,
        status=requirement.status,
        user_story=UserStoryRecord.model_validate(story) if story else None,
    )


@router.post(
    "/api/requirements/{requirement_id}/analyze",
    response_model=RequirementAnalysis,
)
def analyze_requirement(
    requirement_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> RequirementAnalysis:
    requirement = _requirement(db, requirement_id)
    return _analyze_content(_load_content(requirement))


@router.post(
    "/api/projects/{project_id}/requirements/analyze-batch",
    response_model=RequirementBatchAnalysis,
)
def analyze_project_requirements_batch(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> RequirementBatchAnalysis:
    _require_project(db, project_id)
    try:
        requirements = (
            db.query(RawRequirement)
            .filter(
                RawRequirement.project_id == project_id,
                RawRequirement.status == "draft",
            )
            .order_by(RawRequirement.id)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not read draft requirements for batch analysis")
        raise HTTPException(status_code=500, detail="Không thể đọc yêu cầu cần phân tích.") from exc
    return RequirementBatchAnalysis(
        results=[
            RequirementBatchAnalysisItem(
                requirement_id=item.id,
                **_analyze_content(_load_content(item)).model_dump(),
            )
            for item in requirements
        ]
    )


@router.post(
    "/api/projects/{project_id}/requirements/user-stories/preview",
    response_model=UserStoryDraftBatch,
)
def preview_project_user_stories(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> UserStoryDraftBatch:
    _require_project(db, project_id)
    try:
        requirements = (
            db.query(RawRequirement)
            .filter(
                RawRequirement.project_id == project_id,
                RawRequirement.status == "draft",
            )
            .order_by(RawRequirement.id)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not read requirements for user story drafts")
        raise HTTPException(
            status_code=500, detail="Không thể đọc yêu cầu để tạo user story."
        ) from exc
    return UserStoryDraftBatch(
        results=[
            _generate_user_story(_load_content(requirement), requirement.id)
            for requirement in requirements
        ]
    )


@router.patch("/api/requirements/{requirement_id}")
def update_requirement(
    requirement_id: int,
    data: RequirementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, int | str]:
    requirement = _requirement(db, requirement_id)
    if requirement.status != "draft":
        raise HTTPException(status_code=409, detail="Yêu cầu đã xác nhận, không thể sửa.")
    requirement.content = _content(data)
    try:
        record_entity_revision(db, requirement, project_id=requirement.project_id, entity_type="raw_requirement", user_id=current_user.id, change_note="Cập nhật yêu cầu")
        db.commit()
        db.refresh(requirement)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not update requirement")
        raise HTTPException(status_code=500, detail="Không thể cập nhật yêu cầu.") from exc
    return {"id": requirement.id, "status": requirement.status}


@router.delete("/api/requirements/{requirement_id}", status_code=204)
def delete_requirement(
    requirement_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    requirement = _requirement(db, requirement_id)
    if requirement.status != "draft":
        raise HTTPException(status_code=409, detail="Chỉ được xóa yêu cầu ở trạng thái draft.")
    try:
        has_story = db.query(UserStory.id).filter(
            UserStory.requirement_id == requirement_id
        ).first()
        if has_story:
            raise HTTPException(
                status_code=409,
                detail="Không thể xóa yêu cầu đang được tham chiếu bởi user story.",
            )
        # Xóa trace link trỏ đến yêu cầu trước khi xóa bản ghi.
        db.query(TraceLink).filter(
            or_(
                ((TraceLink.source_type.in_(("requirement", "raw_requirement"))) & (TraceLink.source_id == requirement_id)),
                ((TraceLink.target_type.in_(("requirement", "raw_requirement"))) & (TraceLink.target_id == requirement_id)),
            )
        ).delete(synchronize_session=False)
        db.delete(requirement)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not delete raw requirement")
        raise HTTPException(status_code=500, detail="Không thể xóa yêu cầu.") from exc


@router.post("/api/requirements/{requirement_id}/user-story", response_model=UserStoryRecord)
def save_requirement_user_story(
    requirement_id: int,
    data: UserStoryDraftContent,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserStoryRecord:
    """Save one reviewed User Story and confirm its source requirement."""
    requirement = _requirement(db, requirement_id)
    try:
        story = (
            db.query(UserStory)
            .filter(UserStory.requirement_id == requirement.id)
            .order_by(UserStory.id.desc())
            .first()
        )
        if story is None:
            story = UserStory(requirement_id=requirement.id, **data.model_dump())
            db.add(story)
        else:
            story.role = data.role
            story.feature = data.feature
            story.benefit = data.benefit
            story.acceptance_criteria = data.acceptance_criteria
        requirement.status = "confirmed"
        db.flush()
        record_entity_revision(db, story, project_id=requirement.project_id, entity_type="user_story", user_id=current_user.id, change_type="create" if story.id is None else "update", change_note="Lưu User Story")
        record_entity_revision(db, requirement, project_id=requirement.project_id, entity_type="raw_requirement", user_id=current_user.id, change_note="Xác nhận yêu cầu")
        db.commit()
        db.refresh(story)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not save a single User Story")
        raise HTTPException(status_code=500, detail="Không thể lưu User Story.") from exc
    return UserStoryRecord.model_validate(story)


@router.post(
    "/api/requirements/{requirement_id}/confirm",
    response_model=UserStoryRecord,
)
def confirm_requirement(
    requirement_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> UserStoryRecord:
    requirement = _requirement(db, requirement_id)
    content = _load_content(requirement)
    try:
        existing_story = (
            db.query(UserStory)
            .filter(UserStory.requirement_id == requirement.id)
            .order_by(UserStory.id.desc())
            .first()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not read existing user story")
        raise HTTPException(
            status_code=500, detail="Không thể đọc user story hiện có."
        ) from exc
    if existing_story is not None:
        return UserStoryRecord.model_validate(existing_story)
    if requirement.status != "draft":
        raise HTTPException(
            status_code=409,
            detail="Yêu cầu đã xác nhận nhưng chưa có user story liên kết.",
        )

    story = UserStory(
        requirement_id=requirement.id,
        role=content["actor"],
        feature=f"{content['action']} {content['target_object']}".strip(),
        benefit=content["purpose"],
        acceptance_criteria="",
    )
    requirement.status = "confirmed"
    try:
        db.add(story)
        db.commit()
        db.refresh(story)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not confirm requirement")
        raise HTTPException(status_code=500, detail="Không thể xác nhận yêu cầu.") from exc
    return UserStoryRecord.model_validate(story)


@router.post(
    "/api/projects/{project_id}/requirements/confirm-batch",
    response_model=list[UserStoryRecord],
)
def confirm_project_requirements_batch(
    project_id: int,
    data: ConfirmRequirementsBatch,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[UserStoryRecord]:
    _require_project(db, project_id)
    unique_ids = list(dict.fromkeys(data.requirement_ids))
    user_stories_by_requirement = {
        story.requirement_id: story for story in data.user_stories or []
    }
    if data.user_stories is not None and (
        len(user_stories_by_requirement) != len(data.user_stories)
        or set(user_stories_by_requirement) != set(unique_ids)
    ):
        raise HTTPException(
            status_code=422,
            detail="Danh sách user story phải khớp chính xác với các yêu cầu cần xác nhận.",
        )
    try:
        requirements = (
            db.query(RawRequirement)
            .filter(
                RawRequirement.project_id == project_id,
                RawRequirement.id.in_(unique_ids),
            )
            .order_by(RawRequirement.id)
            .all()
        )
        if len(requirements) != len(unique_ids):
            raise HTTPException(
                status_code=404,
                detail="Một hoặc nhiều yêu cầu không thuộc dự án hoặc không tồn tại.",
            )
        stories: list[UserStory] = []
        for requirement in requirements:
            content = _load_content(requirement)
            candidate = user_stories_by_requirement.get(requirement.id)
            if data.user_stories is None:
                analysis = _analyze_content(content)
                if not analysis.is_complete:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Yêu cầu {requirement.id} còn thiếu thông tin và chưa thể xác nhận.",
                    )
            story = (
                db.query(UserStory)
                .filter(UserStory.requirement_id == requirement.id)
                .order_by(UserStory.id.desc())
                .first()
            )
            if story is None:
                story = UserStory(
                    requirement_id=requirement.id,
                    role=candidate.role if candidate else content["actor"],
                    feature=(
                        candidate.feature
                        if candidate
                        else f"{content['action']} {content['target_object']}".strip()
                    ),
                    benefit=candidate.benefit if candidate else content["purpose"],
                    acceptance_criteria=(
                        candidate.acceptance_criteria if candidate else ""
                    ),
                )
                db.add(story)
            elif candidate is not None:
                story.role = candidate.role
                story.feature = candidate.feature
                story.benefit = candidate.benefit
                story.acceptance_criteria = candidate.acceptance_criteria
            requirement.status = "confirmed"
            stories.append(story)
        db.commit()
        for story in stories:
            db.refresh(story)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not confirm project requirements batch")
        raise HTTPException(status_code=500, detail="Không thể xác nhận yêu cầu.") from exc
    return [UserStoryRecord.model_validate(story) for story in stories]


@router.get(
    "/api/projects/{project_id}/user-stories",
    response_model=list[UserStoryRecord],
)
def list_project_user_stories(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[UserStoryRecord]:
    _require_project(db, project_id)
    try:
        stories = (
            db.query(UserStory)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .filter(RawRequirement.project_id == project_id)
            .order_by(UserStory.id)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not list project user stories")
        raise HTTPException(status_code=500, detail="Không thể đọc user story của dự án.") from exc
    return [UserStoryRecord.model_validate(story) for story in stories]


@router.get("/api/user-stories/{story_id}", response_model=UserStoryRecord)
def get_user_story(
    story_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserStoryRecord:
    try:
        story = db.query(UserStory).filter(UserStory.id == story_id).first()
    except SQLAlchemyError as exc:
        logger.exception("Could not read user story")
        raise HTTPException(status_code=500, detail="Không thể đọc user story.") from exc
    if story is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy user story.")
    return UserStoryRecord.model_validate(story)


@router.patch("/api/user-stories/{story_id}", response_model=UserStoryRecord)
def update_user_story(
    story_id: int,
    data: UserStoryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> UserStoryRecord:
    try:
        story = db.query(UserStory).filter(UserStory.id == story_id).first()
        if story is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy user story.")
        story.role = data.role
        story.feature = data.feature
        story.benefit = data.benefit
        story.acceptance_criteria = data.acceptance_criteria
        requirement = db.query(RawRequirement).filter(RawRequirement.id == story.requirement_id).first()
        if requirement is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu gốc của User Story.")
        record_entity_revision(db, story, project_id=requirement.project_id, entity_type="user_story", user_id=current_user.id, change_note="Cập nhật User Story")
        db.commit()
        db.refresh(story)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not update user story")
        raise HTTPException(status_code=500, detail="Không thể cập nhật user story.") from exc
    return UserStoryRecord.model_validate(story)



@router.post("/api/user-stories/{story_id}/improve", response_model=UserStoryRecord)
def improve_user_story(
    story_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> UserStoryRecord:
    """Improve a saved User Story using its source requirement and current draft."""
    try:
        story = db.query(UserStory).filter(UserStory.id == story_id).first()
        if story is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy User Story.")
        requirement = db.query(RawRequirement).filter(
            RawRequirement.id == story.requirement_id
        ).first()
        if requirement is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu gốc của User Story.")
        content = _load_content(requirement)
        prompt = (
            "Bạn là chuyên gia phân tích nghiệp vụ. Hãy hoàn thiện User Story hiện tại "
            "dựa trên yêu cầu gốc. Giữ đúng phạm vi nghiệp vụ, không tự thêm chức năng "
            "không được hỗ trợ bởi yêu cầu. Viết role, feature, benefit rõ ràng, độc lập; "
            "acceptance_criteria phải kiểm thử được, mỗi tiêu chí trên một dòng. "
            "Trả về đúng JSON theo schema được cung cấp.\n"
            f"Yêu cầu gốc: {json.dumps(content, ensure_ascii=False)}\n"
            f"User Story hiện tại: {json.dumps({'role': story.role, 'feature': story.feature, 'benefit': story.benefit, 'acceptance_criteria': story.acceptance_criteria}, ensure_ascii=False)}"
        )
        improved = generate_json(prompt, UserStoryDraftContent)
        story.role = improved.role
        story.feature = improved.feature
        story.benefit = improved.benefit
        story.acceptance_criteria = improved.acceptance_criteria
        db.commit()
        db.refresh(story)
    except HTTPException:
        raise
    except AIServiceError as exc:
        db.rollback()
        logger.exception("AI could not improve User Story")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not improve User Story")
        raise HTTPException(status_code=500, detail="Không thể lưu User Story đã hoàn thiện.") from exc
    return UserStoryRecord.model_validate(story)


@router.delete("/api/user-stories/{story_id}", status_code=204)
def delete_user_story(
    story_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    try:
        story = db.query(UserStory).filter(UserStory.id == story_id).first()
        if story is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy user story.")
        if db.query(Specification.id).filter(
            Specification.user_story_id == story_id
        ).first():
            raise HTTPException(
                status_code=409,
                detail="Không thể xóa user story đang được tham chiếu bởi đặc tả.",
            )
        # Xóa trace link trỏ đến User Story để tránh liên kết mồ côi.
        db.query(TraceLink).filter(
            or_(
                ((TraceLink.source_type == "user_story") & (TraceLink.source_id == story_id)),
                ((TraceLink.target_type == "user_story") & (TraceLink.target_id == story_id)),
            )
        ).delete(synchronize_session=False)
        db.delete(story)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not delete user story")
        raise HTTPException(status_code=500, detail="Không thể xóa user story.") from exc
