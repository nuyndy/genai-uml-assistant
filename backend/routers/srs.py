import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import (
    Project,
    RawRequirement,
    Specification,
    SrsDocument,
    User,
    UserStory,
)
from routers.auth import get_current_user
from routers.ownership import require_project_owner
from routers.requirement import _require_project
from routers.specification import _story
from schemas.specification import (
    NonFunctionalSpecification,
    SrsDocumentMetaInput,
    SpecificationDocumentExportInput,
    SpecificationRecord,
)
from services.ollama import AIServiceError, generate_content
from services.spec_generator import build_nonfunctional_spec_prompt
from services.srs_export import markdown_to_docx

router = APIRouter(
    tags=["srs"],
    dependencies=[Depends(require_project_owner)],
)
logger = logging.getLogger(__name__)
META_FIELDS = (
    ("intro_purpose", "1.1 Mục đích"),
    ("intro_scope", "1.2 Phạm vi"),
    ("intro_definitions", "1.3 Định nghĩa, thuật ngữ và từ viết tắt"),
    ("overview_user_classes", "2.1 Các lớp người dùng"),
    ("overview_environment", "2.2 Môi trường vận hành"),
    ("appendix_notes", "4. Phụ lục"),
)


def _spec_record(item: Specification, feature: str) -> SpecificationRecord:
    return SpecificationRecord(
        id=item.id,
        user_story_id=item.user_story_id,
        feature=feature,
        type=item.type,
        content=item.content,
        version=item.version,
    )


def _get_meta(db: Session, project_id: int) -> SrsDocument:
    meta = db.query(SrsDocument).filter(SrsDocument.project_id == project_id).first()
    if meta is None:
        meta = SrsDocument(
            project_id=project_id,
            intro_purpose="",
            intro_scope="",
            intro_definitions="",
            overview_user_classes="",
            overview_environment="",
            appendix_notes="",
        )
    return meta


def _specification_data(db: Session, project_id: int) -> list[SpecificationRecord]:
    rows = (
        db.query(Specification, UserStory.feature)
        .outerjoin(UserStory, Specification.user_story_id == UserStory.id)
        .outerjoin(RawRequirement, UserStory.requirement_id == RawRequirement.id)
        .filter(
            (RawRequirement.project_id == project_id)
            | (Specification.project_id == project_id)
        )
        .order_by(Specification.type, Specification.id)
        .all()
    )
    return [
        _spec_record(item, feature or "Đặc tả phi chức năng")
        for item, feature in rows
    ]


def _append_specification_markdown(
    markdown: list[str],
    item: SpecificationRecord,
) -> None:
    try:
        body = json.loads(item.content)
    except json.JSONDecodeError:
        body = {"content": item.content}
    markdown.extend([f"#### {item.feature}", ""])
    if item.type == "functional" and "function_code" in body:
        markdown.extend([
            f"- Mã chức năng: {body['function_code']}",
            f"- Tên chức năng: {body['function_name']}",
            f"- Mô tả: {body['description']}",
            f"- Mức ưu tiên: {body['priority']}",
            f"- Tác nhân: {', '.join(body['actors'])}",
            "",
        ])
        for field, title in (
            ("pre_conditions", "Điều kiện tiên quyết"),
            ("main_flow", "Luồng chính"),
            ("alternative_flows", "Luồng thay thế"),
            ("exception_flows", "Luồng ngoại lệ"),
            ("post_conditions", "Điều kiện sau"),
            ("business_rules", "Quy tắc nghiệp vụ"),
        ):
            markdown.extend([f"##### {title}", ""])
            markdown.extend([f"- {entry}" for entry in body[field]] or ["- Không có."])
            markdown.append("")
        markdown.extend([
            "##### Ánh xạ trường dữ liệu",
            "",
            "| Tên trường | Kiểu dữ liệu | Bắt buộc | Quy tắc kiểm tra |",
            "| --- | --- | --- | --- |",
        ])
        markdown.extend(
            f"| {field['field_name']} | {field['data_type']} | "
            f"{'Có' if field['required'] else 'Không'} | {field['validation_rule']} |"
            for field in body["field_mapping"]
        )
        markdown.append("")
    elif item.type == "non_functional" and isinstance(body.get("items"), list):
        for entry in body["items"]:
            markdown.extend([
                f"#### {entry['group']}",
                "",
                f"- Tiêu chí: {entry['criteria']}",
                f"- Yêu cầu: {entry['requirement']}",
                "",
            ])
    elif "content" in body:
        markdown.extend([str(body["content"]), ""])


@router.post(
    "/api/projects/{project_id}/specifications/non-functional",
    response_model=SpecificationRecord,
    status_code=201,
)
def generate_nonfunctional_specification(
    project_id: int,
    regenerate: bool = Query(default=False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SpecificationRecord:
    _require_project(db, project_id)
    try:
        db.query(Project.id).filter(Project.id == project_id).with_for_update().one()
        existing = db.query(Specification).filter(
            Specification.project_id == project_id,
            Specification.type == "non_functional",
        ).with_for_update().first()
    except SQLAlchemyError as exc:
        logger.exception("Could not check existing non-functional specification")
        raise HTTPException(status_code=500, detail="Không thể kiểm tra đặc tả hiện có.") from exc
    if existing and not regenerate:
        raise HTTPException(
            status_code=409,
            detail="Đã có đặc tả, vui lòng sửa tay thay vì sinh lại",
        )
    features = [
        feature for (feature,) in db.query(UserStory.feature)
        .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
        .filter(RawRequirement.project_id == project_id)
        .order_by(UserStory.id)
        .all()
    ]
    try:
        raw = generate_content(
            build_nonfunctional_spec_prompt(features),
            json_response=True,
        )
        content = NonFunctionalSpecification.model_validate(json.loads(raw))
    except AIServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except (json.JSONDecodeError, ValidationError, ValueError) as exc:
        logger.exception("AI returned an invalid non-functional specification")
        raise HTTPException(
            status_code=502, detail="AI trả về đặc tả phi chức năng không đúng cấu trúc."
        ) from exc
    if existing:
        item = existing
        item.content = content.model_dump_json()
    else:
        item = Specification(
            user_story_id=None,
            project_id=project_id,
            type="non_functional",
            content=content.model_dump_json(),
            version=1,
        )
    try:
        db.add(item)
        db.commit()
        db.refresh(item)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Đã có đặc tả, vui lòng sửa tay thay vì sinh lại",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not save generated non-functional specification")
        raise HTTPException(status_code=500, detail="Không thể lưu đặc tả.") from exc
    return _spec_record(item, "Đặc tả phi chức năng")


@router.put("/api/projects/{project_id}/srs-document-meta")
def save_srs_document_meta(
    project_id: int,
    data: SrsDocumentMetaInput,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict[str, object]:
    _require_project(db, project_id)
    try:
        meta = db.query(SrsDocument).filter(SrsDocument.project_id == project_id).first()
        if meta is None:
            meta = SrsDocument(project_id=project_id, **data.model_dump())
            db.add(meta)
        else:
            for key, value in data.model_dump().items():
                setattr(meta, key, value)
        db.commit()
        db.refresh(meta)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not save SRS document metadata")
        raise HTTPException(status_code=500, detail="Không thể lưu thông tin tài liệu SRS.") from exc
    return {"project_id": project_id, "updated_at": meta.updated_at}


@router.get("/api/projects/{project_id}/specification-document")
def get_specification_document(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict[str, object]:
    _require_project(db, project_id)
    meta = _get_meta(db, project_id)
    specs = _specification_data(db, project_id)
    functional = [item for item in specs if item.type == "functional"]
    nonfunctional = [item for item in specs if item.type == "non_functional"]
    metadata = {key: getattr(meta, key) for key, _ in META_FIELDS}
    sections: list[dict[str, object]] = [
        {
            "number": "1",
            "title": "Giới thiệu",
            "fields": [
                {"key": key, "title": title, "content": metadata[key]}
                for key, title in META_FIELDS[:3]
            ],
        },
        {
            "number": "2",
            "title": "Mô tả tổng thể",
            "fields": [
                {"key": key, "title": title, "content": metadata[key]}
                for key, title in META_FIELDS[3:5]
            ],
        },
        {
            "number": "3",
            "title": "Chi tiết yêu cầu",
            "subsections": [
                {
                    "number": "3.1",
                    "title": "Đặc tả chức năng",
                    "specifications": [item.model_dump() for item in functional],
                },
                {
                    "number": "3.2",
                    "title": "Đặc tả phi chức năng",
                    "specifications": [item.model_dump() for item in nonfunctional],
                },
            ],
        },
        {
            "number": "4",
            "title": "Phụ lục",
            "fields": [
                {"key": "appendix_notes", "title": "Ghi chú", "content": meta.appendix_notes}
            ],
        },
    ]
    markdown = [
        "# Tài liệu đặc tả yêu cầu phần mềm (SRS)",
        "",
        "## 1. Giới thiệu",
    ]
    for key, title in META_FIELDS[:3]:
        markdown.extend([f"### {title}", metadata[key] or "Chưa có nội dung.", ""])
    markdown.append("## 2. Mô tả tổng thể")
    for key, title in META_FIELDS[3:5]:
        markdown.extend([f"### {title}", metadata[key] or "Chưa có nội dung.", ""])
    markdown.append("## 3. Chi tiết yêu cầu")
    for title, selected in (("3.1 Đặc tả chức năng", functional), ("3.2 Đặc tả phi chức năng", nonfunctional)):
        markdown.extend([f"### {title}", ""])
        if not selected:
            markdown.extend(["Chưa có đặc tả.", ""])
        for item in selected:
            _append_specification_markdown(markdown, item)
    markdown.extend(["## 4. Phụ lục", "", meta.appendix_notes or "Chưa có nội dung.", ""])
    return {
        "project_id": project_id,
        "updated_at": meta.updated_at,
        "metadata": metadata,
        "sections": sections,
        "raw_markdown": "\n".join(markdown),
    }


@router.post("/api/projects/{project_id}/specification-document/export")
def export_specification_document(
    project_id: int,
    data: SpecificationDocumentExportInput,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Response:
    document = get_specification_document(project_id, db, _)
    markdown = str(document["raw_markdown"])
    try:
        content = markdown_to_docx(markdown)
    except (ImportError, RuntimeError) as exc:
        logger.exception("Could not export SRS document")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="SRS-project-{project_id}.docx"'},
    )
