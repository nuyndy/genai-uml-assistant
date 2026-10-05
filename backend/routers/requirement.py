import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import Project, RawRequirement, Specification, User, UserStory
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
    UserStoryRecord,
    UserStoryUpdate,
)
from services.ollama import AIServiceError, generate_content

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
    conditions = content.get("pre_conditions", [])
    rules = content.get("business_rules", [])
    natural_description = (
        f"Với vai trò {content.get('actor', '')}, người dùng muốn "
        f"{content.get('action', '')} {content.get('target_object', '')} "
        f"để {content.get('purpose', '')}."
    )
    prompt = (
        "Đánh giá tính đầy đủ và rõ ràng của yêu cầu phần mềm sau để có thể "
        "đặc tả đúng chức năng được mô tả. Chỉ đánh giá thông tin liên quan "
        "trực tiếp đến chức năng, tác nhân, hành động, đối tượng, mục đích, "
        "điều kiện trước và quy tắc nghiệp vụ. Không yêu cầu định dạng tài liệu, "
        "phông chữ, mã hóa ký tự hoặc các chi tiết không liên quan. Không suy "
        "diễn rằng các trường dữ liệu hay quy trình chưa nêu là bắt buộc nếu "
        "chúng không cần thiết để hiểu chức năng. Không tự bịa dữ kiện còn thiếu. "
        "Chỉ liệt kê thông tin cụ thể còn thiếu mà thực sự ngăn cản việc đặc tả. "
        "Chỉ trả về JSON hợp lệ theo cấu trúc "
        '{"is_complete": boolean, "missing_elements": [string], '
        '"feedback": string}. Đặt is_complete=false nếu còn thiếu dữ kiện '
        "cần thiết hoặc diễn đạt mơ hồ.\n\n"
        f"Mô tả: {natural_description}\n"
        f"Điều kiện trước: {json.dumps(conditions, ensure_ascii=False)}\n"
        f"Quy tắc nghiệp vụ: {json.dumps(rules, ensure_ascii=False)}"
    )
    try:
        raw_result = generate_content(prompt, json_response=True)
        return RequirementAnalysis.model_validate(json.loads(raw_result))
    except AIServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except (json.JSONDecodeError, ValueError) as exc:
        logger.exception("AI returned invalid requirement analysis")
        raise HTTPException(
            status_code=502, detail="AI trả về kết quả phân tích không hợp lệ."
        ) from exc


def _generate_user_story(content: dict, requirement_id: int) -> UserStoryDraft:
    prompt = (
        "Chuyển yêu cầu phần mềm sau thành bản nháp User Story có thể kiểm duyệt. "
        "Phân tích và điền đủ role, feature, benefit, acceptance_criteria; "
        "Dựa duy nhất trên dữ liệu đầu vào; không tự tạo vai trò, quy tắc nghiệp vụ, "
        "điều kiện hay hành vi không được nêu. Có thể diễn đạt lại cho rõ ràng. "
        "Nếu trường nào chưa có đủ căn cứ, ghi rõ '[Cần xác nhận: ...]' thay vì "
        "tự bịa dữ kiện. Trả về JSON hợp lệ với đủ các khóa role, feature, benefit, "
        "acceptance_criteria; tất cả đều là chuỗi không rỗng.\n\n"
        f"Yêu cầu: {json.dumps(content, ensure_ascii=False)}"
    )
    try:
        raw_result = generate_content(prompt, json_response=True)
        data = json.loads(raw_result)
        return UserStoryDraft.model_validate(
            {**data, "requirement_id": requirement_id}
        )
    except AIServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except (json.JSONDecodeError, ValidationError, ValueError) as exc:
        logger.exception("AI returned invalid user story draft")
        raise HTTPException(
            status_code=502, detail="AI trả về bản nháp user story không hợp lệ."
        ) from exc


@router.post("/api/projects/{project_id}/requirements", status_code=201)
def create_requirement(
    project_id: int,
    data: RequirementUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict[str, int | str]:
    _require_project(db, project_id)
    requirement = RawRequirement(
        project_id=project_id,
        content=_content(data),
        status="draft",
    )
    try:
        db.add(requirement)
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
    prompt = (
        "Bạn là chuyên gia phân tích yêu cầu phần mềm. Đánh giá xem danh sách yêu cầu "
        "đã bao quát các chức năng cần thiết cho hệ thống hay chưa. Dựa trên tên dự án "
        "và các yêu cầu hiện có; không giả định một ngành nghiệp vụ cụ thể nếu dữ liệu "
        "không cho biết. Chỉ đề xuất chức năng thiết yếu còn thiếu, không trùng lặp "
        "hoặc diễn đạt lại chức năng đã có. Mỗi đề xuất phải cụ thể, có tác nhân, hành "
        "động, đối tượng, mục đích; không bịa quy tắc nghiệp vụ hoặc điều kiện chưa có "
        "căn cứ. Tối đa 10 đề xuất. Nếu đã đủ hoặc thiếu căn cứ để đề xuất thì trả "
        "suggestions rỗng và giải thích trong summary. Trả về duy nhất JSON hợp lệ theo "
        'cấu trúc {"is_sufficient": boolean, "summary": string, "suggestions": '
        '[{"actor": string, "action": string, "target_object": string, '
        '"purpose": string, "pre_conditions": [string], "business_rules": [string], '
        '"reason": string}]}. Mọi đề xuất chỉ là gợi ý, chưa được lưu.\n\n'
        f"Tên hệ thống: {project.name}\n"
        f"Yêu cầu hiện có: {json.dumps(items, ensure_ascii=False)}"
    )
    try:
        raw_result = generate_content(prompt, json_response=True)
        return RequirementCoverageAnalysis.model_validate(json.loads(raw_result))
    except AIServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except (json.JSONDecodeError, ValidationError, ValueError) as exc:
        logger.exception("AI returned invalid project requirement coverage analysis")
        raise HTTPException(
            status_code=502,
            detail="AI trả về kết quả kiểm tra chức năng không hợp lệ.",
        ) from exc


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
    _: User = Depends(get_current_user),
) -> dict[str, int | str]:
    requirement = _requirement(db, requirement_id)
    if requirement.status != "draft":
        raise HTTPException(status_code=409, detail="Yêu cầu đã xác nhận, không thể sửa.")
    requirement.content = _content(data)
    try:
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
        db.delete(requirement)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not delete raw requirement")
        raise HTTPException(status_code=500, detail="Không thể xóa yêu cầu.") from exc


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
    _: User = Depends(get_current_user),
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
        db.commit()
        db.refresh(story)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not update user story")
        raise HTTPException(status_code=500, detail="Không thể cập nhật user story.") from exc
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
        db.delete(story)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not delete user story")
        raise HTTPException(status_code=500, detail="Không thể xóa user story.") from exc
