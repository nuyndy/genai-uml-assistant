import hashlib
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import (
    FunctionalConsolidationCheckpoint,
    Project,
    RawRequirement,
    Specification,
    SpecificationApproval,
    TraceLink,
    UseCase,
    User,
    UserStory,
)
from routers.auth import get_current_user
from routers.ownership import require_project_owner
from routers.requirement import _require_project
from schemas.specification import (
    FunctionalSpecification,
    FunctionalSpecificationBatch,
    GenerateSpecificationInput,
    NonFunctionalSpecification,
    SpecificationApprovalResult,
    SpecificationRecord,
    SpecificationUpdate,
)
from services.spec_generator import build_functional_spec_prompt, build_consolidated_functional_specs_prompt
from services.ollama import AIServiceError, generate_json

router = APIRouter(
    tags=["specifications"],
    dependencies=[Depends(require_project_owner)],
)
logger = logging.getLogger(__name__)


def _story(db: Session, story_id: int) -> UserStory:
    try:
        story = (
            db.query(UserStory)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .join(Project, RawRequirement.project_id == Project.id)
            .filter(UserStory.id == story_id)
            .first()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not read user story")
        raise HTTPException(status_code=500, detail="Không thể đọc user story.") from exc
    if story is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy user story.")
    return story


def _approval_status(db: Session, specification_id: int) -> str:
    """Đọc trạng thái duyệt thật, không mặc định draft khi đặc tả đã được duyệt."""
    approval = (
        db.query(SpecificationApproval)
        .filter(SpecificationApproval.specification_id == specification_id)
        .first()
    )
    return approval.status if approval is not None else "draft"


def _specification(db: Session, specification_id: int) -> Specification:
    try:
        specification = db.query(Specification).filter(
            Specification.id == specification_id
        ).first()
    except SQLAlchemyError as exc:
        logger.exception("Could not read specification")
        raise HTTPException(status_code=500, detail="Không thể đọc đặc tả.") from exc
    if specification is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy đặc tả.")
    return specification


@router.post(
    "/api/user-stories/{user_story_id}/specifications",
    response_model=SpecificationRecord,
    status_code=201,
)
def generate_specification(
    user_story_id: int,
    data: GenerateSpecificationInput = GenerateSpecificationInput(type="functional"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SpecificationRecord:
    story = _story(db, user_story_id)
    try:
        db.query(UserStory).filter(UserStory.id == story.id).with_for_update().one()
        existing = db.query(Specification).filter(
            Specification.user_story_id == story.id,
            Specification.type == "functional",
        ).with_for_update().first()
    except SQLAlchemyError as exc:
        logger.exception("Could not check existing functional specification")
        raise HTTPException(status_code=500, detail="Không thể kiểm tra đặc tả hiện có.") from exc
    if existing is not None and not data.regenerate:
        raise HTTPException(
            status_code=409,
            detail="Đã có đặc tả, vui lòng sửa tay thay vì sinh lại",
        )
    if data.type != "functional":
        raise HTTPException(status_code=422, detail="Đặc tả phi chức năng được sinh theo dự án.")

    try:
        content = generate_json(
            build_functional_spec_prompt(story, f"UC{story.id:02d}"),
            FunctionalSpecification,
        )
    except AIServiceError as exc:
        logger.exception("AI returned an invalid functional specification")
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if existing is not None:
        specification = existing
        specification.content = content.model_dump_json()
        approval = db.query(SpecificationApproval).filter(
            SpecificationApproval.specification_id == existing.id
        ).first()
        if approval is not None:
            approval.status = "draft"
            approval.approved_by = None
            approval.approved_at = None
    else:
        specification = Specification(
            user_story_id=story.id,
            type="functional",
            content=content.model_dump_json(),
            version=1,
        )
    try:
        db.add(specification)
        db.commit()
        db.refresh(specification)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Đã có đặc tả, vui lòng sửa tay thay vì sinh lại",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not save generated specification")
        raise HTTPException(status_code=500, detail="Không thể lưu đặc tả.") from exc
    return SpecificationRecord(
        id=specification.id,
        user_story_id=story.id,
        feature=story.feature,
        type="functional",
        content=specification.content,
        version=specification.version,
    )


@router.get("/api/projects/{project_id}/specifications/functional/consolidation-status")
def get_functional_consolidation_status(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict[str, object]:
    """Trạng thái tiến trình để giao diện hiển thị công việc AI đang thực hiện."""
    _require_project(db, project_id)
    try:
        checkpoint = (
            db.query(FunctionalConsolidationCheckpoint)
            .filter(FunctionalConsolidationCheckpoint.project_id == project_id)
            .first()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not read functional consolidation status")
        raise HTTPException(status_code=500, detail="Không thể đọc tiến trình tổng hợp FR.") from exc
    if checkpoint is None:
        return {
            "status": "idle",
            "current_batch": 0,
            "total_batches": 0,
            "completed_batches": 0,
            "status_message": "Chưa có lượt tổng hợp FR đang chạy.",
        }
    try:
        completed = json.loads(checkpoint.completed_batches or "[]")
        completed_count = len(completed) if isinstance(completed, list) else 0
    except (TypeError, json.JSONDecodeError):
        completed_count = 0
    return {
        "status": checkpoint.status,
        "current_batch": checkpoint.current_batch,
        "total_batches": checkpoint.total_batches,
        "completed_batches": completed_count,
        "status_message": checkpoint.status_message,
        "updated_at": checkpoint.updated_at.isoformat() if checkpoint.updated_at else None,
    }


@router.post(
    "/api/projects/{project_id}/specifications/functional/consolidate",
    response_model=list[SpecificationRecord],
)
def consolidate_project_functional_specifications(
    project_id: int,
    regenerate: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SpecificationRecord]:
    """Tổng hợp toàn bộ US của dự án thành các FR độc lập, có truy vết nguồn."""
    _require_project(db, project_id)
    try:
        stories = (
            db.query(UserStory)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .filter(RawRequirement.project_id == project_id)
            .order_by(UserStory.id.asc())
            .all()
        )
        if not stories:
            raise HTTPException(status_code=422, detail="Dự án chưa có User Story để tổng hợp.")
        existing = (
            db.query(Specification)
            .filter(
                Specification.project_id == project_id,
                Specification.type == "functional",
            )
            .order_by(Specification.id.asc())
            .all()
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        logger.exception("Could not load user stories for functional consolidation")
        raise HTTPException(status_code=500, detail="Không thể đọc User Story của dự án.") from exc

    # Lô nhỏ giúp Qwen2.5:3B chạy trên máy ít RAM. Lưu kết quả từng lô
    # để khi Ollama timeout, lần gọi lại có thể tiếp tục từ lô chưa hoàn thành.
    # Bộ FR chính thức chỉ được thay sau khi toàn bộ lô qua kiểm tra.
    batch_size = 2
    story_snapshot = [
        {
            "id": story.id,
            "role": story.role,
            "feature": story.feature,
            "benefit": story.benefit,
            "acceptance_criteria": story.acceptance_criteria,
        }
        for story in stories
    ]
    story_signature = hashlib.sha256(
        json.dumps(story_snapshot, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()
    try:
        checkpoint = (
            db.query(FunctionalConsolidationCheckpoint)
            .filter(FunctionalConsolidationCheckpoint.project_id == project_id)
            .first()
        )
        if checkpoint is None:
            checkpoint = FunctionalConsolidationCheckpoint(
                project_id=project_id,
                story_signature=story_signature,
                completed_batches="[]",
                status="starting",
                current_batch=0,
                total_batches=(len(stories) + batch_size - 1) // batch_size,
                status_message="Đang chuẩn bị dữ liệu User Story...",
            )
            db.add(checkpoint)
            db.commit()
            db.refresh(checkpoint)
        elif checkpoint.story_signature != story_signature:
            checkpoint.story_signature = story_signature
            checkpoint.completed_batches = "[]"
            checkpoint.current_batch = 0
            checkpoint.total_batches = (len(stories) + batch_size - 1) // batch_size
            checkpoint.status = "starting"
            checkpoint.status_message = "User Story đã thay đổi; đang tạo tiến trình mới..."
            db.commit()
        else:
            checkpoint.total_batches = (len(stories) + batch_size - 1) // batch_size
            checkpoint.status = "running"
            checkpoint.status_message = "Đang tiếp tục từ các nhóm đã lưu..."
            db.commit()

        try:
            completed_batches = json.loads(checkpoint.completed_batches or "[]")
            if not isinstance(completed_batches, list):
                completed_batches = []
        except (TypeError, json.JSONDecodeError):
            completed_batches = []
        if len(completed_batches) > (len(stories) + batch_size - 1) // batch_size:
            completed_batches = []
        if checkpoint.completed_batches != json.dumps(completed_batches, ensure_ascii=False):
            checkpoint.completed_batches = json.dumps(completed_batches, ensure_ascii=False)
            db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not load functional consolidation checkpoint")
        raise HTTPException(
            status_code=500,
            detail="Không thể đọc tiến trình tổng hợp FR. Hãy chạy migration 005.",
        ) from exc

    generated_items: list[FunctionalSpecification] = []
    try:
        for batch_index, start in enumerate(range(0, len(stories), batch_size)):
            checkpoint.current_batch = batch_index + 1
            if batch_index < len(completed_batches):
                checkpoint.status = "running"
                checkpoint.status_message = f"Đang khôi phục kết quả nhóm {batch_index + 1}/{checkpoint.total_batches} đã lưu trước đó..."
                db.commit()
                batch_items = [
                    FunctionalSpecification.model_validate(item)
                    for item in completed_batches[batch_index]
                ]
            else:
                story_batch = stories[start : start + batch_size]
                story_numbers = ", ".join(f"US-{story.id:03d}" for story in story_batch)
                checkpoint.status = "generating"
                checkpoint.status_message = (
                    f"Đang gửi {story_numbers} tới Ollama; AI đang phân tích và sinh nội dung FR "
                    f"(nhóm {batch_index + 1}/{checkpoint.total_batches})."
                )
                db.commit()
                batch_result = generate_json(
                    build_consolidated_functional_specs_prompt(story_batch),
                    FunctionalSpecificationBatch,
                )
                batch_items = batch_result.items
                completed_batches.append(
                    [item.model_dump(mode="json") for item in batch_items]
                )
                checkpoint.completed_batches = json.dumps(
                    completed_batches, ensure_ascii=False
                )
                checkpoint.status = "running"
                checkpoint.status_message = (
                    f"Đã sinh xong nhóm {batch_index + 1}/{checkpoint.total_batches}; "
                    "đã lưu checkpoint. Đang chuẩn bị nhóm tiếp theo..."
                )
                db.add(checkpoint)
                db.commit()
            generated_items.extend(batch_items)
        checkpoint.status = "validating"
        checkpoint.status_message = "AI đã sinh xong các nhóm; đang kiểm tra truy vết và độ bao phủ User Story..."
        db.commit()
    except AIServiceError as exc:
        logger.exception("AI failed to consolidate functional specifications batch")
        try:
            checkpoint.status = "error"
            checkpoint.status_message = f"AI gặp lỗi: {exc}"
            db.add(checkpoint)
            db.commit()
        except SQLAlchemyError:
            db.rollback()
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except (ValidationError, SQLAlchemyError, TypeError, ValueError) as exc:
        db.rollback()
        try:
            checkpoint.status = "error"
            checkpoint.status_message = "Không thể khôi phục hoặc kiểm tra dữ liệu checkpoint; xem log backend."
            db.add(checkpoint)
            db.commit()
        except SQLAlchemyError:
            db.rollback()
        logger.exception("Could not resume functional consolidation checkpoint")
        raise HTTPException(
            status_code=500,
            detail="Không thể khôi phục tiến trình tổng hợp FR. Hãy thử chạy lại.",
        ) from exc

    valid_story_ids = {story.id for story in stories}
    normalized_items: list[FunctionalSpecification] = []
    for index, item in enumerate(generated_items, start=1):
        item.function_code = f"FR-{index:03d}"
        item.source_user_story_ids = sorted(set(item.source_user_story_ids) & valid_story_ids)
        if not item.source_user_story_ids:
            db.delete(checkpoint)
            db.commit()
            raise HTTPException(
                status_code=502,
                detail=f"{item.function_code} chưa truy vết được về User Story nguồn; hãy chạy lại để AI sinh lại các lô.",
            )
        normalized_items.append(item)

    covered_story_ids = {
        story_id
        for item in normalized_items
        for story_id in item.source_user_story_ids
    }
    uncovered_story_ids = sorted(valid_story_ids - covered_story_ids)
    if uncovered_story_ids:
        db.delete(checkpoint)
        db.commit()
        raise HTTPException(
            status_code=502,
            detail="AI chưa bao phủ các User Story: "
            + ", ".join(f"US-{story_id:03d}" for story_id in uncovered_story_ids)
            + ". Hãy chạy lại để AI sinh lại các lô.",
        )

    try:
        checkpoint.status = "saving"
        checkpoint.status_message = "Đang lưu bộ FR mới sau khi kiểm tra thành công..."
        db.commit()
        # Chỉ xóa bộ FR tổng hợp cũ sau khi kết quả mới đã sinh và qua kiểm tra.
        for old_item in existing:
            if db.query(UseCase.id).filter(UseCase.specification_id == old_item.id).first():
                raise HTTPException(
                    status_code=409,
                    detail="Bộ FR tổng hợp đang được Use Case tham chiếu; không thể thay thế an toàn.",
                )
        for old_item in existing:
            db.query(SpecificationApproval).filter(
                SpecificationApproval.specification_id == old_item.id
            ).delete(synchronize_session=False)
            db.query(TraceLink).filter(
                or_(
                    ((TraceLink.source_type == "specification") & (TraceLink.source_id == old_item.id)),
                    ((TraceLink.target_type == "specification") & (TraceLink.target_id == old_item.id)),
                )
            ).delete(synchronize_session=False)
            db.delete(old_item)
        db.flush()
        saved: list[Specification] = []
        for item in normalized_items:
            record = Specification(
                user_story_id=None,
                project_id=project_id,
                type="functional",
                content=item.model_dump_json(),
                version=1,
            )
            db.add(record)
            saved.append(record)
        db.delete(checkpoint)
        db.commit()
        for item in saved:
            db.refresh(item)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not save consolidated functional specifications")
        raise HTTPException(status_code=500, detail="Không thể lưu bộ FR tổng hợp.") from exc

    return [
        SpecificationRecord(
            id=record.id,
            user_story_id=None,
            feature=normalized_items[index].function_name,
            type="functional",
            content=record.content,
            version=record.version,
            approval_status="draft",
        )
        for index, record in enumerate(saved)
    ]


@router.post(
    "/api/projects/{project_id}/user-stories/generate-specs-batch",
    response_model=list[SpecificationRecord],
)
def generate_project_specifications_batch(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SpecificationRecord]:
    _require_project(db, project_id)
    try:
        stories = (
            db.query(UserStory)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .outerjoin(
                Specification,
                (Specification.user_story_id == UserStory.id)
                & (Specification.type == "functional"),
            )
            .filter(RawRequirement.project_id == project_id, Specification.id.is_(None))
            .order_by(UserStory.id)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not list user stories without functional specifications")
        raise HTTPException(status_code=500, detail="Không thể đọc user story cần đặc tả.") from exc

    generated: list[tuple[UserStory, str]] = []
    if stories:
        # Chạy tối đa 2 lượt sinh đồng thời để giảm thời gian chờ tổng thể,
        # nhưng giới hạn tải lên Ollama để tránh làm nghẽn model cục bộ.
        from concurrent.futures import ThreadPoolExecutor

        prompts = [
            (story, build_functional_spec_prompt(story, f"UC{story.id:02d}"))
            for story in stories
        ]
        try:
            with ThreadPoolExecutor(max_workers=min(2, len(prompts))) as executor:
                contents = list(
                    executor.map(
                        lambda item: generate_json(item[1], FunctionalSpecification),
                        prompts,
                    )
                )
            generated = [
                (story, content.model_dump_json())
                for (story, _), content in zip(prompts, contents, strict=True)
            ]
        except AIServiceError as exc:
            logger.exception("AI returned an invalid functional specification in batch")
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    saved: list[Specification] = []
    try:
        for story, content in generated:
            specification = Specification(
                user_story_id=story.id,
                type="functional",
                content=content,
                version=1,
            )
            db.add(specification)
            saved.append(specification)
        db.commit()
        for item in saved:
            db.refresh(item)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not save generated specification batch")
        raise HTTPException(status_code=500, detail="Không thể lưu đặc tả.") from exc

    features = {story.id: story.feature for story, _ in generated}
    return [
        SpecificationRecord(
            id=item.id,
            user_story_id=item.user_story_id,
            feature=features[item.user_story_id],
            type=item.type,
            content=item.content,
            version=item.version,
        )
        for item in saved
    ]


@router.get(
    "/api/specifications/{specification_id}/approval",
    response_model=SpecificationApprovalResult,
)
def get_specification_approval(
    specification_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SpecificationApprovalResult:
    specification = _specification(db, specification_id)
    approval = db.query(SpecificationApproval).filter(
        SpecificationApproval.specification_id == specification.id
    ).first()
    return SpecificationApprovalResult(
        specification_id=specification.id,
        approval_status=approval.status if approval else "draft",
        approved_at=approval.approved_at.isoformat() if approval and approval.approved_at else None,
    )


@router.post(
    "/api/specifications/{specification_id}/approve",
    response_model=SpecificationApprovalResult,
)
def approve_specification(
    specification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SpecificationApprovalResult:
    specification = _specification(db, specification_id)
    try:
        value = json.loads(specification.content)
        schema = (
            FunctionalSpecification
            if specification.type == "functional"
            else NonFunctionalSpecification
        )
        schema.model_validate(value)
        approval = db.query(SpecificationApproval).filter(
            SpecificationApproval.specification_id == specification.id
        ).with_for_update().first()
        if approval is None:
            approval = SpecificationApproval(
                specification_id=specification.id,
                status="approved",
                approved_by=user.id,
                approved_at=datetime.now(timezone.utc),
            )
            db.add(approval)
        else:
            approval.status = "approved"
            approval.approved_by = user.id
            approval.approved_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(approval)
    except (json.JSONDecodeError, ValidationError, ValueError, TypeError) as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Không thể duyệt đặc tả có nội dung chưa hợp lệ.",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not approve specification")
        raise HTTPException(status_code=500, detail="Không thể duyệt đặc tả.") from exc
    return SpecificationApprovalResult(
        specification_id=specification.id,
        approval_status=approval.status,
        approved_at=approval.approved_at.isoformat() if approval.approved_at else None,
    )


@router.patch(
    "/api/specifications/{specification_id}",
    response_model=SpecificationRecord,
)
def update_specification(
    specification_id: int,
    data: SpecificationUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SpecificationRecord:
    specification = _specification(db, specification_id)
    try:
        value = json.loads(data.content) if isinstance(data.content, str) else data.content
        schema = (
            FunctionalSpecification
            if specification.type == "functional"
            else NonFunctionalSpecification
        )
        content = schema.model_validate(value)
    except (json.JSONDecodeError, ValidationError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=422,
            detail="Nội dung đặc tả không đúng schema đã quy định.",
        ) from exc
    specification.content = content.model_dump_json()
    specification.version += 1
    try:
        # Mọi thay đổi nội dung đều thu hồi phê duyệt trước đó.
        approval = db.query(SpecificationApproval).filter(
            SpecificationApproval.specification_id == specification.id
        ).with_for_update().first()
        if approval is not None:
            approval.status = "draft"
            approval.approved_by = None
            approval.approved_at = None
        db.commit()
        db.refresh(specification)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not update specification")
        raise HTTPException(status_code=500, detail="Không thể cập nhật đặc tả.") from exc
    story = (
        db.query(UserStory).filter(UserStory.id == specification.user_story_id).first()
        if specification.user_story_id is not None
        else None
    )
    return SpecificationRecord(
        id=specification.id,
        user_story_id=specification.user_story_id,
        feature=story.feature if story else "Đặc tả phi chức năng",
        type=specification.type,
        content=specification.content,
        version=specification.version,
    )


@router.get(
    "/api/user-stories/{user_story_id}/specifications",
    response_model=list[SpecificationRecord],
)
def list_user_story_specifications(
    user_story_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SpecificationRecord]:
    story = _story(db, user_story_id)
    try:
        specifications = (
            db.query(Specification)
            .filter(Specification.user_story_id == story.id)
            .order_by(Specification.id)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not list user story specifications")
        raise HTTPException(status_code=500, detail="Không thể đọc đặc tả của user story.") from exc
    return [
        SpecificationRecord(
            id=item.id,
            user_story_id=item.user_story_id,
            feature=story.feature,
            type=item.type,
            content=item.content,
            version=item.version,
            approval_status=_approval_status(db, item.id),
        )
        for item in specifications
    ]


@router.get(
    "/api/specifications/{specification_id}",
    response_model=SpecificationRecord,
)
def get_specification(
    specification_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SpecificationRecord:
    specification = _specification(db, specification_id)
    story = (
        _story(db, specification.user_story_id)
        if specification.user_story_id is not None
        else None
    )
    return SpecificationRecord(
        id=specification.id,
        user_story_id=specification.user_story_id,
        feature=story.feature if story else "Đặc tả phi chức năng",
        type=specification.type,
        content=specification.content,
        version=specification.version,
        approval_status=_approval_status(db, specification.id),
    )


@router.delete("/api/specifications/{specification_id}", status_code=204)
def delete_specification(
    specification_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    specification = _specification(db, specification_id)
    try:
        if db.query(UseCase.id).filter(
            UseCase.specification_id == specification_id
        ).first():
            raise HTTPException(
                status_code=409,
                detail="Không thể xóa đặc tả đang được tham chiếu bởi use case.",
            )
        # Xóa trace link trỏ đến đặc tả trước khi xóa bản ghi.
        db.query(TraceLink).filter(
            or_(
                ((TraceLink.source_type == "specification") & (TraceLink.source_id == specification_id)),
                ((TraceLink.target_type == "specification") & (TraceLink.target_id == specification_id)),
            )
        ).delete(synchronize_session=False)
        db.delete(specification)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not delete specification")
        raise HTTPException(status_code=500, detail="Không thể xóa đặc tả.") from exc


@router.get(
    "/api/projects/{project_id}/specifications",
    response_model=list[SpecificationRecord],
)
def list_project_specifications(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SpecificationRecord]:
    _require_project(db, project_id)
    try:
        rows = (
            db.query(
                Specification,
                UserStory.feature,
                SpecificationApproval.status,
            )
            .outerjoin(UserStory, Specification.user_story_id == UserStory.id)
            .outerjoin(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .outerjoin(
                SpecificationApproval,
                SpecificationApproval.specification_id == Specification.id,
            )
            .filter(or_(
                RawRequirement.project_id == project_id,
                Specification.project_id == project_id,
            ))
            .order_by(Specification.id.asc())
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not list project specifications")
        raise HTTPException(
            status_code=500, detail="Không thể đọc đặc tả của dự án."
        ) from exc
    return [
        SpecificationRecord(
            id=specification.id,
            user_story_id=specification.user_story_id,
            feature=feature or (json.loads(specification.content).get("function_name", "Đặc tả phi chức năng") if specification.type == "functional" else "Đặc tả phi chức năng"),
            type=specification.type,
            content=specification.content,
            version=specification.version,
            approval_status=approval_status or "draft",
        )
        for specification, feature, approval_status in rows
    ]
