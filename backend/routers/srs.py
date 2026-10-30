import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from typing import Optional
from database.db import get_db

from database.models import (
    Project,
    RawRequirement,
    Specification,
    SrsDocument,
    User,
    UserStory,
    ProjectBaseline,
    SpecificationApproval,
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
from services.entity_revision import record_entity_revision
from services.ollama import AIServiceError, generate_content, generate_json, strip_code_fence
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
    has_consolidated_fr = any(
        item.project_id == project_id and item.type == "functional" and item.user_story_id is None
        for item, _ in rows
    )
    return [
        _spec_record(
            item,
            feature or (
                json.loads(item.content).get("function_name", "Đặc tả phi chức năng")
                if item.type == "functional"
                else "Đặc tả phi chức năng"
            ),
        )
        for item, feature in rows
        if not (
            has_consolidated_fr
            and item.type == "functional"
            and item.user_story_id is not None
        )
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
        content = generate_json(
            build_nonfunctional_spec_prompt(features),
            NonFunctionalSpecification,
        )
    except AIServiceError as exc:
        logger.exception("AI returned an invalid non-functional specification")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if existing:
        item = existing
        item.content = content.model_dump_json()
        # Sinh lại NFR làm thay đổi nội dung đã duyệt, nên phải thu hồi
        # phê duyệt giống như khi người dùng sửa đặc tả thủ công.
        approval = db.query(SpecificationApproval).filter(
            SpecificationApproval.specification_id == existing.id
        ).with_for_update().first()
        if approval is not None:
            approval.status = "draft"
            approval.approved_by = None
            approval.approved_at = None
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


@router.post("/api/projects/{project_id}/srs-document-meta/generate")
def generate_srs_document_meta(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """Generate the non-FR/NFR narrative sections of the SRS from project context."""
    project = _require_project(db, project_id)
    requirements = (
        db.query(RawRequirement)
        .filter(RawRequirement.project_id == project_id)
        .order_by(RawRequirement.id)
        .all()
    )
    stories = (
        db.query(UserStory)
        .filter(UserStory.requirement_id.in_([item.id for item in requirements]))
        .order_by(UserStory.id)
        .all()
    )
    def _short_text(value: object, limit: int = 240) -> str:
        text = str(value or "").strip()
        return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"

    # Chỉ cần ngữ cảnh đại diện để viết các mục mô tả chung của SRS.
    # Tránh gửi toàn bộ lịch sử yêu cầu dài vào model nhỏ (qwen2.5:3b),
    # vốn có thể khiến Ollama mất vài phút chỉ để xử lý prompt.
    context = {
        "project": _short_text(
            getattr(project, "name", None) or getattr(project, "title", None) or f"Dự án {project_id}",
            120,
        ),
        "requirements": [
            {
                "content": _short_text(item.normalized_text or item.content),
                "actor": _short_text(item.actor, 80),
                "action": _short_text(item.action, 100),
                "target_object": _short_text(item.target_object, 100),
                "purpose": _short_text(item.purpose, 160),
            }
            for item in requirements[:10]
        ],
        "user_stories": [
            {
                "role": _short_text(item.role, 80),
                "feature": _short_text(item.feature, 160),
                "benefit": _short_text(item.benefit, 160),
            }
            for item in stories[:10]
        ],
        "total_requirements": len(requirements),
        "total_user_stories": len(stories),
    }
    prompt = f"""
Bạn là chuyên gia phân tích nghiệp vụ và biên soạn SRS theo IEEE 830.
Dựa CHỈ trên ngữ cảnh tóm tắt bên dưới, hãy viết 6 trường SRS bằng tiếng Việt.
Không tạo lại hoặc liệt kê FR/NFR; không bịa công nghệ, số liệu hay nghiệp vụ.
Mỗi trường tối đa 2 câu ngắn; nếu thiếu căn cứ, ghi rõ cần xác nhận.
Chỉ trả JSON hợp lệ với đúng 6 khóa:
intro_purpose, intro_scope, intro_definitions, overview_user_classes,
overview_environment, appendix_notes. Mỗi giá trị là chuỗi, không markdown.
Ngữ cảnh dự án:
{json.dumps(context, ensure_ascii=False, default=str)}
"""
    try:
        generated_text = generate_content(prompt, json_response=True)
        generated = json.loads(strip_code_fence(generated_text))
        if not isinstance(generated, dict):
            raise ValueError("AI response must be a JSON object")
        fields = ("intro_purpose", "intro_scope", "intro_definitions",
                  "overview_user_classes", "overview_environment", "appendix_notes")
        result = {key: str(generated.get(key, "")).strip() for key in fields}
        if not any(result.values()):
            raise ValueError("AI returned empty SRS metadata")
        return result
    except (AIServiceError, ValueError, TypeError) as exc:
        logger.exception("Could not generate SRS metadata")
        raise HTTPException(status_code=502, detail="Không thể hoàn thiện các trường SRS bằng AI.") from exc


@router.put("/api/projects/{project_id}/srs-document-meta")
def save_srs_document_meta(
    project_id: int,
    data: SrsDocumentMetaInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    _require_project(db, project_id)
    try:
        meta = db.query(SrsDocument).filter(SrsDocument.project_id == project_id).first()
        is_new = meta is None
        if is_new:
            meta = SrsDocument(project_id=project_id, **data.model_dump())
            db.add(meta)
        else:
            for key, value in data.model_dump().items():
                setattr(meta, key, value)
        db.flush()
        record_entity_revision(
            db,
            project_id=project_id,
            entity_type="srs_document",
            entity_id=meta.id,
            content={
                "intro_purpose": meta.intro_purpose,
                "intro_scope": meta.intro_scope,
                "intro_definitions": meta.intro_definitions,
                "overview_user_classes": meta.overview_user_classes,
                "overview_environment": meta.overview_environment,
                "appendix_notes": meta.appendix_notes,
            },
            change_type="create" if is_new else "update",
            change_note="Lưu thông tin tài liệu SRS",
            created_by=current_user.id,
        )
        db.commit()
        db.refresh(meta)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not save SRS document metadata")
        raise HTTPException(status_code=500, detail="Không thể lưu thông tin tài liệu SRS.") from exc
    return {"project_id": project_id, "updated_at": meta.updated_at}



def _srs_markdown_from_baseline_snapshot(snapshot: dict) -> str:
    """Tạo tài liệu SRS có cấu trúc rõ ràng từ snapshot baseline."""
    import json

    entities = snapshot.get("entities", {})
    meta_rows = entities.get("srs_document", [])
    meta = meta_rows[0] if meta_rows and isinstance(meta_rows[0], dict) else {}

    lines = [
        "# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM",
        "",
        "**Software Requirements Specification (SRS)**",
        "",
        "## 1. Giới thiệu",
        "",
        "### 1.1. Mục đích",
        "",
        str(meta.get("intro_purpose") or "Chưa cập nhật."),
        "",
        "### 1.2. Phạm vi",
        "",
        str(meta.get("intro_scope") or "Chưa cập nhật."),
        "",
        "### 1.3. Định nghĩa và thuật ngữ",
        "",
        str(meta.get("intro_definitions") or "Chưa cập nhật."),
        "",
        "## 2. Mô tả tổng quan",
        "",
        "### 2.1. Nhóm người dùng",
        "",
        str(meta.get("overview_user_classes") or "Chưa cập nhật."),
        "",
        "### 2.2. Môi trường hoạt động",
        "",
        str(meta.get("overview_environment") or "Chưa cập nhật."),
        "",
        "## 3. Yêu cầu chi tiết",
        "",
    ]

    specifications = entities.get("specification", [])
    stories = {
        row["id"]: row
        for row in entities.get("user_story", [])
        if isinstance(row, dict) and row.get("id") is not None
    }

    field_labels = {
        "function_code": "Mã chức năng",
        "function_name": "Tên chức năng",
        "description": "Mô tả",
        "actors": "Tác nhân",
        "priority": "Mức ưu tiên",
        "pre_conditions": "Điều kiện tiên quyết",
        "main_flow": "Luồng chính",
        "alternative_flows": "Luồng thay thế",
        "exception_flows": "Luồng ngoại lệ",
        "post_conditions": "Điều kiện hậu",
        "business_rules": "Quy tắc nghiệp vụ",
        "field_mapping": "Thông tin dữ liệu",
    }

    def display_value(value):
        """Chuyển dữ liệu thành văn bản dễ đọc, không in JSON thô."""
        if value is None:
            return ""

        if isinstance(value, bool):
            return "Có" if value else "Không"

        if isinstance(value, dict):
            return "\n".join(
                f"- **{key.replace('_', ' ').capitalize()}:** "
                f"{display_value(val)}"
                for key, val in value.items()
                if val is not None and val != ""
            )

        if isinstance(value, list):
            result = []
            for val in value:
                if isinstance(val, dict):
                    result.append(display_value(val))
                elif val is not None and val != "":
                    result.append(str(val))
            return "\n".join(
                f"{index}. {text}"
                for index, text in enumerate(result, start=1)
            )

        return str(value)

    def add_section(label, value, heading_level=5):
        """Thêm một tiểu mục nếu có dữ liệu."""
        rendered = display_value(value)
        if not rendered.strip():
            return

        heading = "#" * heading_level
        lines.extend([
            f"{heading} {label}",
            "",
            rendered,
            "",
        ])

    def parse_content(content):
        if isinstance(content, dict):
            return content

        if isinstance(content, str):
            try:
                parsed = json.loads(content or "{}")
                if isinstance(parsed, (dict, list)):
                    return parsed
                return {"description": parsed}
            except (json.JSONDecodeError, TypeError):
                return {"description": content}

        return {"description": str(content or "")}

    # 3.1. Đặc tả chức năng
    lines.extend([
        "### 3.1. Đặc tả chức năng",
        "",
    ])

    functional_specs = [
        spec for spec in specifications
        if spec.get("type") == "functional"
    ]

    if not functional_specs:
        lines.extend(["Chưa có đặc tả chức năng.", ""])

    for index, spec in enumerate(functional_specs, start=1):
        body = parse_content(spec.get("content"))
        if isinstance(body, list):
            body = {"description": body}

        story = stories.get(spec.get("user_story_id"), {})

        code = body.get("function_code")
        name = body.get("function_name")
        feature = (
            name
            or story.get("feature")
            or story.get("title")
            or f"Đặc tả chức năng {index}"
        )

        heading = f"#### 3.1.{index}. {feature}"
        if code:
            heading = f"#### 3.1.{index}. {code} – {feature}"

        lines.extend([heading, ""])

        # Hiển thị các trường chính theo thứ tự chuẩn của SRS.
        ordered_fields = [
            "description",
            "actors",
            "priority",
            "pre_conditions",
            "main_flow",
            "alternative_flows",
            "exception_flows",
            "post_conditions",
            "business_rules",
            "field_mapping",
        ]

        for key in ordered_fields:
            value = body.get(key)

            if key == "field_mapping":
                if not isinstance(value, list) or not value:
                    continue

                lines.extend([
                    "##### Thông tin dữ liệu",
                    "",
                    "| Tên trường | Kiểu dữ liệu | Bắt buộc | Quy tắc kiểm tra |",
                    "|---|---|---|---|",
                ])

                for field in value:
                    if not isinstance(field, dict):
                        lines.append(
                            f"| {str(field)} | — | — | — |"
                        )
                        continue

                    def cell(val):
                        return (
                            str(val if val is not None else "—")
                            .replace("|", "\\|")
                            .replace("\n", " ")
                        )

                    lines.append(
                        "| "
                        + " | ".join([
                            cell(field.get("field_name")),
                            cell(field.get("data_type")),
                            cell(
                                "Có" if field.get("required") is True
                                else "Không" if field.get("required") is False
                                else "—"
                            ),
                            cell(field.get("validation_rule")),
                        ])
                        + " |"
                    )

                lines.append("")
                continue

            label = field_labels.get(
                key, key.replace("_", " ").capitalize()
            )
            add_section(label, value)

        # Giữ lại các trường mở rộng nếu có.
        known_fields = {
            "function_code",
            "function_name",
            *ordered_fields,
        }

        for key, value in body.items():
            if key in known_fields or value in (None, "", [], {}):
                continue

            label = key.replace("_", " ").capitalize()
            add_section(label, value)

    # 3.2. Đặc tả phi chức năng
    lines.extend([
        "### 3.2 Đặc tả phi chức năng",
        "",
    ])

    non_functional_specs = [
        spec for spec in specifications
        if spec.get("type") == "non_functional"
    ]

    if not non_functional_specs:
        lines.extend(["Chưa có đặc tả phi chức năng.", ""])

    for index, spec in enumerate(non_functional_specs, start=1):
        body = parse_content(spec.get("content"))
        lines.extend([
            f"#### Đặc tả phi chức năng {index}",
            "",
        ])

        if isinstance(body, dict) and isinstance(body.get("items"), list):
            for group_index, item in enumerate(body["items"], start=1):
                if not isinstance(item, dict):
                    lines.extend([
                        f"##### Nhóm {group_index}",
                        "",
                        display_value(item),
                        "",
                    ])
                    continue

                group = item.get("group") or f"Nhóm {group_index}"
                lines.extend([f"##### {group}", ""])

                add_section("Tiêu chí", item.get("criteria"))
                add_section("Yêu cầu", item.get("requirement"))

                for key, value in item.items():
                    if key in {"group", "criteria", "requirement"}:
                        continue
                    add_section(
                        key.replace("_", " ").capitalize(),
                        value,
                    )
        elif isinstance(body, dict):
            for key, value in body.items():
                add_section(
                    key.replace("_", " ").capitalize(),
                    value,
                )
        else:
            lines.extend([display_value(body), ""])

    # 4. Phụ lục
    lines.extend([
        "## 4. Phụ lục",
        "",
        str(meta.get("appendix_notes") or "Chưa có nội dung."),
        "",
    ])

    return "\n".join(lines)


@router.get("/api/projects/{project_id}/specification-document")
def get_specification_document(
    project_id: int,
    baseline_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict[str, object]:
    _require_project(db, project_id)

    baseline = None

    if baseline_id is not None:
        baseline = (
            db.query(ProjectBaseline)
            .filter(
                ProjectBaseline.id == baseline_id,
                ProjectBaseline.project_id == project_id,
            )
            .first()
        )
        if baseline is None:
            raise HTTPException(
                status_code=404,
                detail="Không tìm thấy baseline trong dự án.",
            )
    else:
        baseline = (
            db.query(ProjectBaseline)
            .filter(
                ProjectBaseline.project_id == project_id,
                ProjectBaseline.status == "approved",
            )
            .order_by(ProjectBaseline.version.desc())
            .first()
        )

    if baseline is not None:
        snapshot = baseline.snapshot
        if not isinstance(snapshot, dict):
            raise HTTPException(
                status_code=409,
                detail="Snapshot baseline không hợp lệ.",
            )
    else:
        # Preview từ dữ liệu hiện tại, không tạo baseline giả.
        meta_row = _get_meta(db, project_id)
        specifications = _specification_data(db, project_id)
        stories = (
            db.query(UserStory)
            .join(
                RawRequirement,
                UserStory.requirement_id == RawRequirement.id,
            )
            .filter(RawRequirement.project_id == project_id)
            .all()
        )

        snapshot = {
            "entities": {
                "srs_document": [
                    {
                        key: getattr(meta_row, key, None)
                        for key, _ in META_FIELDS
                    }
                ],
                "specification": [
                    {
                        "id": item.id,
                        "user_story_id": item.user_story_id,
                        "type": item.type,
                        "content": item.content,
                        "version": item.version,
                    }
                    for item in specifications
                ],
                "user_story": [
                    {
                        "id": story.id,
                        "feature": story.feature,
                    }
                    for story in stories
                ],
            }
        }

    entities = snapshot.get("entities", {})
    meta_rows = entities.get("srs_document", [])
    meta = meta_rows[0] if meta_rows else {}
    metadata = {
        key: meta.get(key)
        for key, _ in META_FIELDS
    }

    specifications = entities.get("specification", [])
    stories = {
        row.get("id"): row
        for row in entities.get("user_story", [])
    }

    functional = []
    nonfunctional = []

    for spec in specifications:
        story = stories.get(spec.get("user_story_id"), {})
        record = {
            **spec,
            "feature": (
                story.get("feature")
                or f"Đặc tả #{spec.get('id', '')}"
            ),
        }

        if spec.get("type") == "functional":
            functional.append(record)
        elif spec.get("type") == "non_functional":
            nonfunctional.append(record)

    sections: list[dict[str, object]] = [
        {
            "number": "1",
            "title": "Giới thiệu",
            "fields": [
                {
                    "key": key,
                    "title": title,
                    "content": metadata.get(key),
                }
                for key, title in META_FIELDS[:3]
            ],
        },
        {
            "number": "2",
            "title": "Mô tả tổng thể",
            "fields": [
                {
                    "key": key,
                    "title": title,
                    "content": metadata.get(key),
                }
                for key, title in META_FIELDS[3:5]
            ],
        },
        {
            "number": "3",
            "title": "Yêu cầu cụ thể",
            "functional": functional,
            "non_functional": nonfunctional,
        },
        {
            "number": "4",
            "title": "Phụ lục",
            "fields": [
                {
                    "key": "appendix_notes",
                    "title": "4. Phụ lục",
                    "content": metadata.get("appendix_notes"),
                }
            ],
        },
    ]

    markdown = _srs_markdown_from_baseline_snapshot(snapshot)

    return {
        "project_id": project_id,
        "baseline_id": baseline.id if baseline is not None else None,
        "baseline_version": (
            baseline.version if baseline is not None else None
        ),
        "baseline_status": baseline.status if baseline is not None else "preview",
        "is_official": baseline is not None and baseline.status == "approved",
        "updated_at": (
            (baseline.approved_at or baseline.created_at)
            if baseline is not None
            else None
        ),
        "metadata": metadata,
        "sections": sections,
        "raw_markdown": markdown,
    }

@router.post("/api/projects/{project_id}/specification-document/export")

def export_specification_document(
    project_id: int,
    data: SpecificationDocumentExportInput,
    baseline_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Response:
    project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if project is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy project.",
        )

    # Có baseline_id: lấy đúng baseline được yêu cầu,
    # kể cả khi baseline đang ở trạng thái draft.
    if baseline_id is not None:
        baseline = (
            db.query(ProjectBaseline)
            .filter(
                ProjectBaseline.id == baseline_id,
                ProjectBaseline.project_id == project_id,
            )
            .first()
        )

        if baseline is None:
            raise HTTPException(
                status_code=404,
                detail="Không tìm thấy baseline trong dự án.",
            )
    else:
        # Không chỉ định baseline: chỉ xuất baseline đã duyệt.
        baseline = (
            db.query(ProjectBaseline)
            .filter(
                ProjectBaseline.project_id == project_id,
                ProjectBaseline.status == "approved",
            )
            .order_by(ProjectBaseline.version.desc())
            .first()
        )

        if baseline is None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Chưa có baseline được duyệt. "
                    "Hãy tạo và duyệt baseline trước khi xuất DOCX chính thức."
                ),
            )

    # Cổng xuất bản bắt buộc áp dụng ở backend, kể cả khi client truyền
    # trực tiếp baseline_id của một bản nháp.
    if baseline.status != "approved":
        raise HTTPException(
            status_code=409,
            detail="Chỉ baseline đã được duyệt mới được phép xuất SRS DOCX chính thức.",
        )

    if (
        not isinstance(baseline.snapshot, dict)
        or baseline.snapshot.get("project_id") != project_id
        or not isinstance(baseline.snapshot.get("entities"), dict)
    ):
        raise HTTPException(
            status_code=409,
            detail="Snapshot baseline không hợp lệ hoặc không thuộc project này, không thể xuất DOCX.",
        )

    entities = baseline.snapshot["entities"]
    if not isinstance(entities.get("specification"), list):
        raise HTTPException(
            status_code=409,
            detail="Snapshot baseline thiếu danh sách đặc tả, không thể xuất DOCX.",
        )

    markdown = _srs_markdown_from_baseline_snapshot(
        baseline.snapshot
    )

    try:
        content = markdown_to_docx(markdown)
    except (ImportError, RuntimeError) as exc:
        logger.exception("Could not export SRS document")
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc

    return Response(
        content=content,
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        ),
        headers={
            "Content-Disposition": (
                f'attachment; filename="SRS-project-{project_id}-'
                f'baseline-{baseline.version}.docx"'
            )
        },
    )
