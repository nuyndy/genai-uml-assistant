import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import (
    Actor,
    ClassRelation,
    ClassEntity,
    Diagram,
    DiagramRevision,
    Project,
    RawRequirement,
    Specification,
    TraceLink,
    SpecificationApproval,
    UcActorRelation,
    UseCase,
    User,
    UserStory,
)
from routers.auth import get_current_user
from routers.ownership import require_project_owner
from routers.requirement import _require_project
from schemas.uml import (
    ActorCreate,
    ActorRecord,
    ActorRelationInput,
    ActorRelationRecord,
    ActorUpdate,
    ClassCreate,
    ClassDiagramSuggestion,
    ClassEntityRecord,
    ClassRelationInput,
    ClassRelationRecord,
    ClassUpdate,
    DiagramRecord,
    DiagramRevisionRecord,
    DiagramUpdate,
    ExtractActorsUseCasesResult,
    ExtractProjectActorsUseCasesResult,
    InteractionDiagramInput,
    ProjectUmlState,
    SaveActorUseCasesBatch,
    SaveActorUseCasesBatchResult,
    SpecificationWithStoryRecord,
    UseCaseCreate,
    UseCaseRecord,
    UseCaseScenarioSuggestion,
    UseCaseScenarioBatchItem,
    UseCaseScenarioBatchResult,
    UseCaseUpdate,
)
from services.ollama import AIServiceError, generate_json
from services.plantuml import PlantUMLRenderError, render_plantuml
from services.plantuml_parser import parse_plantuml

router = APIRouter(
    tags=["uml"],
    dependencies=[Depends(require_project_owner)],
)
logger = logging.getLogger(__name__)


def _require_approved_specifications(db: Session, project_id: int) -> None:
    """Chỉ kiểm tra bộ đặc tả đang có hiệu lực của dự án.

    Khi đã có FR tổng hợp cấp dự án (user_story_id=None), các FR cũ gắn
    riêng từng User Story là dữ liệu legacy và không được dùng để chặn UML.
    NFR vẫn được kiểm tra theo trạng thái duyệt như bình thường.
    """
    rows = (
        db.query(
            Specification.id,
            Specification.type,
            Specification.user_story_id,
            Specification.project_id,
            SpecificationApproval.status,
        )
        .outerjoin(UserStory, Specification.user_story_id == UserStory.id)
        .outerjoin(RawRequirement, UserStory.requirement_id == RawRequirement.id)
        .outerjoin(
            SpecificationApproval,
            SpecificationApproval.specification_id == Specification.id,
        )
        .filter(
            (RawRequirement.project_id == project_id)
            | (Specification.project_id == project_id)
        )
        .all()
    )
    if not rows:
        raise HTTPException(
            status_code=409,
            detail="Chưa có đặc tả FR/NFR cho dự án; chưa thể bắt đầu mô hình hóa UML.",
        )

    has_consolidated_functional = any(
        row.type == "functional"
        and row.user_story_id is None
        and row.project_id == project_id
        for row in rows
    )
    active_rows = [
        row for row in rows
        if not (
            has_consolidated_functional
            and row.type == "functional"
            and row.user_story_id is not None
        )
    ]

    missing_types = sorted(
        {"functional", "non_functional"} - {row.type for row in active_rows}
    )
    pending_ids = sorted(
        row.id for row in active_rows if row.status != "approved"
    )
    if missing_types or pending_ids:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Chưa thể tiếp tục Giai đoạn 2 khi FR/NFR chưa được duyệt đầy đủ.",
                "loai_dac_ta_con_thieu": missing_types,
                "dac_ta_chua_duyet": pending_ids,
            },
        )


def _project_for_specification(db: Session, specification_id: int) -> int:
    try:
        row = (
            db.query(RawRequirement.project_id)
            .join(UserStory, UserStory.requirement_id == RawRequirement.id)
            .join(Specification, Specification.user_story_id == UserStory.id)
            .filter(Specification.id == specification_id)
            .first()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not resolve specification project")
        raise HTTPException(status_code=500, detail="Không thể đọc dự án của đặc tả.") from exc
    if row is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy đặc tả.")
    return row[0]


def _use_case(db: Session, use_case_id: int) -> UseCase:
    try:
        use_case = db.query(UseCase).filter(UseCase.id == use_case_id).first()
    except SQLAlchemyError as exc:
        logger.exception("Could not read use case")
        raise HTTPException(status_code=500, detail="Không thể đọc use case.") from exc
    if use_case is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy use case.")
    return use_case


def _project_for_use_case(db: Session, use_case_id: int) -> int:
    try:
        row = (
            db.query(RawRequirement.project_id)
            .join(UserStory, UserStory.requirement_id == RawRequirement.id)
            .join(Specification, Specification.user_story_id == UserStory.id)
            .join(UseCase, UseCase.specification_id == Specification.id)
            .filter(UseCase.id == use_case_id)
            .first()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not resolve use case project")
        raise HTTPException(status_code=500, detail="Không thể đọc dự án của use case.") from exc
    if row is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án của use case.")
    return row[0]


def _decode_lines(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        decoded = json.loads(value)
    except json.JSONDecodeError:
        return [line.strip() for line in value.splitlines() if line.strip()]
    if isinstance(decoded, list) and all(isinstance(item, str) for item in decoded):
        return [item.strip() for item in decoded if item.strip()]
    return [line.strip() for line in value.splitlines() if line.strip()]


def _encode_lines(values: list[str]) -> str:
    return json.dumps([value.strip() for value in values], ensure_ascii=False)


def _functional_fields(specification: Specification) -> dict:
    """Bóc tách `specification.content` thành các trường có nhãn.

    Giai đoạn 1 lưu content dưới dạng chuỗi JSON theo cấu trúc 12 phần đã
    thống nhất. Nếu nhét nguyên chuỗi JSON thô vào prompt, model nhỏ dễ bị
    neo vào cấu trúc đó và trả sai schema; đồng thời thông tin quan trọng như
    `field_mapping` bị bỏ phí. Hàm này chuẩn hoá lại thành dict có khóa rõ
    ràng, chịu được cả trường hợp content là text tự do (dữ liệu cũ).
    """
    try:
        parsed = json.loads(specification.content)
    except (json.JSONDecodeError, TypeError):
        text = (specification.content or "").strip()
        return {"description": text} if text else {}
    if isinstance(parsed, dict):
        return parsed
    if isinstance(parsed, list):
        return {"items": parsed}
    return {"description": str(parsed)}


def _format_specification(specification: Specification, *, index: int) -> str:
    """Mô tả một đặc tả chức năng cho prompt: nhãn rõ từng phần."""
    fields = _functional_fields(specification)

    def as_lines(value: object) -> str:
        if isinstance(value, list):
            items = []
            for item in value:
                if isinstance(item, dict):
                    items.append(
                        "; ".join(f"{key}: {val}" for key, val in item.items())
                    )
                else:
                    items.append(str(item))
            return " | ".join(part for part in items if part)
        return str(value) if value is not None else ""

    lines = [f"SPECIFICATION_ID: {specification.id}"]
    mapping = {
        "function_code": "Mã chức năng",
        "function_name": "Tên chức năng",
        "description": "Mô tả",
        "actors": "Tác nhân",
        "priority": "Ưu tiên",
        "pre_conditions": "Điều kiện trước",
        "main_flow": "Luồng chính",
        "alternative_flows": "Luồng phụ",
        "exception_flows": "Luồng ngoại lệ",
        "post_conditions": "Điều kiện sau",
        "business_rules": "Quy tắc nghiệp vụ",
        "field_mapping": "Trường dữ liệu",
    }
    for key, label in mapping.items():
        if key in fields:
            rendered = as_lines(fields[key])
            if rendered:
                lines.append(f"{label}: {rendered}")
    for key, value in fields.items():
        if key not in mapping:
            rendered = as_lines(value)
            if rendered:
                lines.append(f"{key}: {rendered}")
    return "\n".join(lines)


def _use_case_record(use_case: UseCase) -> UseCaseRecord:
    return UseCaseRecord(
        id=use_case.id,
        specification_id=use_case.specification_id,
        name=use_case.name,
        actor=use_case.actor,
        description=use_case.description,
        preconditions=use_case.preconditions,
        minimal_guarantees=use_case.minimal_guarantees,
        postconditions=use_case.postconditions,
        main_flow=_decode_lines(use_case.main_flow),
        alt_flow=_decode_lines(use_case.alt_flow),
        exception_flow=_decode_lines(use_case.exception_flow),
    )


def _ai_json(prompt: str, model: type) -> object:
    """Gọi AI lấy JSON đúng schema.

    Ràng buộc định dạng và retry/repair do `generate_json` đảm nhiệm, nên mọi
    endpoint đều được bảo vệ giống nhau.
    """
    try:
        return generate_json(prompt, model)
    except AIServiceError as exc:
        logger.warning("AI returned JSON that did not match %s", model.__name__)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def _render_and_save_diagram(
    db: Session,
    project_id: int,
    diagram_type: str,
    source_code: str,
    use_case_id: int | None = None,
) -> Diagram:
    try:
        image_url = render_plantuml(source_code)
    except PlantUMLRenderError as exc:
        _new_project_diagram(
            db,
            project_id,
            diagram_type,
            source_code,
            image_url=None,
            use_case_id=use_case_id,
        )
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return _new_project_diagram(
        db,
        project_id,
        diagram_type,
        source_code,
        image_url,
        use_case_id=use_case_id,
    )


def _quoted(value: str) -> str:
    clean = " ".join(value.replace("\r", " ").replace("\n", " ").split())
    clean = clean.replace('"', '\\"').replace("@", "＠")
    return clean[:500]


def _safe_member(value: str) -> str:
    clean = " ".join(value.replace("\r", " ").replace("\n", " ").split())
    clean = clean.replace("{", "(").replace("}", ")").replace("@", "＠")
    return clean[:500]


def _new_project_diagram(
    db: Session, project_id: int, diagram_type: str, source_code: str, image_url: str | None,
    use_case_id: int | None = None,
) -> Diagram:
    version_query = db.query(func.max(Diagram.version)).filter(
        Diagram.project_id == project_id,
        Diagram.type == diagram_type,
    )
    if use_case_id is None:
        version_query = version_query.filter(Diagram.use_case_id.is_(None))
    else:
        version_query = version_query.filter(Diagram.use_case_id == use_case_id)
    try:
        version = (version_query.scalar() or 0) + 1
    except SQLAlchemyError as exc:
        logger.exception("Could not read diagram versions")
        raise HTTPException(status_code=500, detail="Không thể đọc phiên bản biểu đồ.") from exc
    diagram = Diagram(
        project_id=project_id,
        use_case_id=use_case_id,
        type=diagram_type,
        source_code=source_code,
        image_url=image_url,
        version=version,
    )
    try:
        db.add(diagram)
        db.commit()
        db.refresh(diagram)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not save diagram")
        raise HTTPException(status_code=500, detail="Không thể lưu biểu đồ.") from exc
    return diagram


def _class_diagram_source(
    classes: list[ClassEntity], relations: list[ClassRelation]
) -> str:
    aliases = {item.id: f"C{index + 1}" for index, item in enumerate(classes)}
    lines = ["@startuml", "hide empty members"]
    for item in classes:
        lines.append(f'class "{_quoted(item.name)}" as {aliases[item.id]} {{')
        lines.extend(f"  {_safe_member(value)}" for value in _decode_lines(item.attributes))
        lines.extend(f"  {_safe_member(value)}" for value in _decode_lines(item.methods))
        lines.append("}")
    relation_arrows = {
        "inheritance": "--|>",
        "composition": "*--",
        "aggregation": "o--",
        "dependency": "..>",
        "association": "--",
    }
    for relation in relations:
        arrow = relation_arrows.get((relation.relation_type or "").lower(), "--")
        lines.append(
            f'{aliases[relation.class_a_id]} {arrow} {aliases[relation.class_b_id]} '
            f': {_quoted(relation.relation_type or "association")}'
        )
    lines.append("@enduml")
    return "\n".join(lines)


def _interaction_diagram_source(
    use_case: UseCase,
    project: Project,
    actors: list[Actor],
    diagram_type: str,
    project_actors: list[Actor] | None = None,
) -> str:
    """Dựng mã PlantUML cho biểu đồ tương tác của MỘT use case.

    Biểu đồ tương tác luôn cần một tác nhân khởi động. Nếu use case chưa có quan
    hệ tác nhân tường minh (dữ liệu cũ, hoặc người dùng chỉ lưu use case), ta tự
    dùng tác nhân đầu tiên của dự án thay vì chặn sinh biểu đồ. Chỉ khi dự án
    KHÔNG có tác nhân nào thì mới thực sự không thể vẽ.
    """
    main_flow = _decode_lines(use_case.main_flow)
    alt_flow = _decode_lines(use_case.alt_flow)
    if not main_flow and not alt_flow:
        raise HTTPException(
            status_code=409,
            detail=f"Use case {use_case.id} chưa có kịch bản.",
        )
    chosen_actors = actors or (project_actors or [])
    if not chosen_actors:
        raise HTTPException(
            status_code=409,
            detail=(
                "Dự án chưa có tác nhân nào. Hãy lưu tác nhân và use case ở "
                "Bước 1 trước khi sinh biểu đồ tương tác."
            ),
        )
    alias = "A1"
    actor_name = chosen_actors[0].name
    lines = ["@startuml"]
    if diagram_type == "sequence":
        lines.extend(
            [
                f'actor "{_quoted(actor_name)}" as {alias}',
                f'participant "{_quoted(project.name)}" as SYS',
            ]
        )
        for index, item in enumerate(main_flow, start=1):
            lines.append(f'{alias} -> SYS : {_quoted(f"{index}. {item}")}')
            lines.extend(["activate SYS", f"{alias} <-- SYS : Hoàn tất bước {index}", "deactivate SYS"])
        for index, item in enumerate(alt_flow, start=1):
            lines.extend(
                [
                    f"alt Luồng phụ {index}: {_quoted(item)}",
                    f'{alias} -> SYS : Xử lý luồng phụ {index}',
                    "else Tiếp tục luồng chính",
                    "end",
                ]
            )
    else:
        lines.extend(
            [
                f'actor "{_quoted(actor_name)}" as {alias}',
                f'object "{_quoted(project.name)}" as SYS',
            ]
        )
        for index, item in enumerate(main_flow, start=1):
            lines.append(f'{alias} -> SYS : {index}. {_quoted(item)}')
        for index, item in enumerate(alt_flow, start=1):
            lines.append(f'{alias} ..> SYS : Luồng phụ {index}: {_quoted(item)}')
    lines.extend([f'title {_quoted(use_case.name)}', "@enduml"])
    return "\n".join(lines)



def _render_and_update_diagram(
    db: Session, diagram: Diagram, source_code: str
) -> Diagram:
    try:
        image_url = render_plantuml(source_code)
        change_type = "edit"
    except PlantUMLRenderError as exc:
        image_url = None
        change_type = "edit"

        diagram.source_code = source_code
        diagram.image_url = image_url
        diagram.version = (diagram.version or 0) + 1

        db.add(
            DiagramRevision(
                diagram_id=diagram.id,
                version=diagram.version,
                source_code=diagram.source_code,
                image_url=diagram.image_url,
                change_type=change_type,
            )
        )
        try:
            db.commit()
            db.refresh(diagram)
        except SQLAlchemyError as db_exc:
            db.rollback()
            logger.exception("Could not save pending diagram revision")
            raise HTTPException(
                status_code=500,
                detail="Không thể lưu mã biểu đồ đã cập nhật.",
            ) from db_exc

        raise HTTPException(status_code=503, detail=str(exc)) from exc

    diagram.source_code = source_code
    diagram.image_url = image_url
    diagram.version = (diagram.version or 0) + 1

    db.add(
        DiagramRevision(
            diagram_id=diagram.id,
            version=diagram.version,
            source_code=diagram.source_code,
            image_url=diagram.image_url,
            change_type=change_type,
        )
    )

    try:
        db.commit()
        db.refresh(diagram)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not update diagram")
        raise HTTPException(
            status_code=500,
            detail="Không thể cập nhật biểu đồ.",
        ) from exc

    return diagram




# New endpoint: parse PlantUML source code into UML model for front‑end sync
@router.post(
    "/api/projects/{project_id}/parse-plantuml",
    response_model=dict,
    tags=["uml"],
)
def parse_plantuml_endpoint(
    project_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Parse PlantUML source sent from frontend.

    Expected JSON body: {"source_code": "..."}
    Returns a dictionary with keys: actors, use_cases, classes, relations.
    """
    _require_project(db, project_id)
    source_code = payload.get("source_code", "")
    if not source_code:
        raise HTTPException(status_code=422, detail="source_code không được để trống.")
    try:
        parsed = parse_plantuml(source_code)
    except Exception as exc:
        logger.exception("Lỗi khi parse PlantUML")
        raise HTTPException(status_code=400, detail="Không thể parse PlantUML: " + str(exc))
    return parsed

@router.post(
    "/api/projects/{project_id}/check-uml-consistency",
    response_model=dict,
    tags=["uml"],
)
def check_uml_consistency(
    project_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Compare PlantUML class model with the project's saved UML model."""
    _require_project(db, project_id)

    source_code = payload.get("source_code", "")
    if not isinstance(source_code, str) or not source_code.strip():
        raise HTTPException(
            status_code=422,
            detail="source_code không được để trống.",
        )

    try:
        parsed = parse_plantuml(source_code)

        parsed_classes = {
            item["name"].strip().casefold(): item["name"].strip()
            for item in parsed.get("classes", [])
            if item.get("name", "").strip()
        }

        db_classes = (
            db.query(ClassEntity)
            .filter(ClassEntity.project_id == project_id)
            .order_by(ClassEntity.id)
            .all()
        )

        saved_classes = {
            item.name.strip().casefold(): item.name.strip()
            for item in db_classes
            if item.name and item.name.strip()
        }

        missing_in_database = [
            name
            for key, name in parsed_classes.items()
            if key not in saved_classes
        ]

        missing_in_plantuml = [
            name
            for key, name in saved_classes.items()
            if key not in parsed_classes
        ]

        db_class_ids = {item.id for item in db_classes}
        db_relations = (
            db.query(ClassRelation)
            .filter(
                ClassRelation.class_a_id.in_(db_class_ids)
                & ClassRelation.class_b_id.in_(db_class_ids)
            )
            .order_by(ClassRelation.id)
            .all()
            if db_class_ids
            else []
        )

        db_class_names = {
            item.id: item.name.strip()
            for item in db_classes
            if item.name
        }

        def normalize_relation(source, target, relation_type):
            normalized_type = (relation_type or "association").strip().casefold()
            endpoints = [
                source.strip().casefold(),
                target.strip().casefold(),
            ]
            # Association là quan hệ không định hướng; các quan hệ còn lại
            # cần giữ thứ tự để phát hiện đảo chiều kế thừa/phụ thuộc.
            if normalized_type == "association":
                endpoints.sort()
            return (endpoints[0], endpoints[1], normalized_type)

        source_relations = {
            normalize_relation(
                item["from"],
                item["to"],
                item.get("type", "association"),
            )
            for item in parsed.get("relations", [])
        }

        saved_relations = {
            normalize_relation(
                db_class_names[item.class_a_id],
                db_class_names[item.class_b_id],
                item.relation_type,
            )
            for item in db_relations
            if item.class_a_id in db_class_names
            and item.class_b_id in db_class_names
        }

        missing_relations = [
            {
                "from": source,
                "to": target,
                "type": relation_type,
            }
            for source, target, relation_type in sorted(
                source_relations - saved_relations
            )
        ]

        extra_relations = [
            {
                "from": source,
                "to": target,
                "type": relation_type,
            }
            for source, target, relation_type in sorted(
                saved_relations - source_relations
            )
        ]

        return {
            "project_id": project_id,
            "consistent": not (
                missing_in_database
                or missing_in_plantuml
                or missing_relations
                or extra_relations
            ),
            "missing_in_database": missing_in_database,
            "missing_in_plantuml": missing_in_plantuml,
            "missing_relations": missing_relations,
            "extra_relations": extra_relations,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not check UML consistency")
        raise HTTPException(
            status_code=400,
            detail=f"Không thể kiểm tra tính nhất quán UML: {exc}",
        ) from exc


@router.post(
    "/api/projects/{project_id}/preview-plantuml-sync",
    response_model=dict,
    tags=["uml"],
)
def preview_plantuml_sync(
    project_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Preview class-model changes without modifying the database."""
    _require_project(db, project_id)

    source_code = payload.get("source_code", "")
    if not isinstance(source_code, str) or not source_code.strip():
        raise HTTPException(
            status_code=422,
            detail="source_code không được để trống.",
        )

    try:
        parsed = parse_plantuml(source_code)

        # Load the project's current classes.
        saved_classes = (
            db.query(ClassEntity)
            .filter(ClassEntity.project_id == project_id)
            .order_by(ClassEntity.id)
            .all()
        )

        saved_by_name = {
            item.name.strip().casefold(): item
            for item in saved_classes
            if item.name and item.name.strip()
        }

        parsed_by_name = {}
        for item in parsed.get("classes", []):
            name = (item.get("name") or "").strip()
            if not name:
                continue

            key = name.casefold()
            if key in parsed_by_name:
                raise HTTPException(
                    status_code=422,
                    detail=f"PlantUML có tên lớp trùng nhau: {name}",
                )
            parsed_by_name[key] = item

        add_classes = []
        update_classes = []
        keep_classes = []
        remove_classes = []

        for key, item in parsed_by_name.items():
            name = item["name"].strip()
            attributes = item.get("attributes") or []
            methods = item.get("methods") or []
            existing = saved_by_name.get(key)

            if existing is None:
                add_classes.append({
                    "name": name,
                    "attributes": attributes,
                    "methods": methods,
                })
                continue

            current_attributes = _decode_lines(existing.attributes)
            current_methods = _decode_lines(existing.methods)

            if (
                current_attributes != attributes
                or current_methods != methods
                or existing.name != name
            ):
                update_classes.append({
                    "id": existing.id,
                    "current": {
                        "name": existing.name,
                        "attributes": current_attributes,
                        "methods": current_methods,
                    },
                    "proposed": {
                        "name": name,
                        "attributes": attributes,
                        "methods": methods,
                    },
                })
            else:
                keep_classes.append({
                    "id": existing.id,
                    "name": existing.name,
                })

        for key, item in saved_by_name.items():
            if key not in parsed_by_name:
                remove_classes.append({
                    "id": item.id,
                    "name": item.name,
                    "warning": "Chỉ là đề xuất; chưa xóa khỏi database.",
                })

        return {
            "project_id": project_id,
            "preview_only": True,
            "database_modified": False,
            "summary": {
                "add": len(add_classes),
                "update": len(update_classes),
                "keep": len(keep_classes),
                "remove": len(remove_classes),
            },
            "add_classes": add_classes,
            "update_classes": update_classes,
            "keep_classes": keep_classes,
            "remove_classes": remove_classes,
            "relations_note": (
                "Quan hệ chưa được đồng bộ trong phiên bản preview này."
            ),
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not preview PlantUML synchronization")
        raise HTTPException(
            status_code=400,
            detail=f"Không thể xem trước đồng bộ PlantUML: {exc}",
        ) from exc
@router.get(
    "/api/projects/{project_id}/specifications-with-stories",
    response_model=list[SpecificationWithStoryRecord],
)
def list_unmodeled_specifications(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SpecificationWithStoryRecord]:
    _require_project(db, project_id)
    try:
        rows = (
            db.query(Specification, UserStory)
            .join(UserStory, Specification.user_story_id == UserStory.id)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .outerjoin(UseCase, UseCase.specification_id == Specification.id)
            .filter(RawRequirement.project_id == project_id, UseCase.id.is_(None))
            .order_by(Specification.id.asc())
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not list specifications without use cases")
        raise HTTPException(status_code=500, detail="Không thể đọc đặc tả cần mô hình hóa.") from exc
    return [
        SpecificationWithStoryRecord(
            id=specification.id,
            user_story_id=specification.user_story_id,
            type=specification.type,
            content=specification.content,
            version=specification.version,
            user_story=story,
        )
        for specification, story in rows
    ]


@router.post(
    "/api/specifications/{specification_id}/extract-actors-usecases",
    response_model=ExtractActorsUseCasesResult,
)
def extract_actors_use_cases(
    specification_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ExtractActorsUseCasesResult:
    project_id = _project_for_specification(db, specification_id)
    _require_approved_specifications(db, project_id)
    try:
        specification = db.query(Specification).filter(
            Specification.id == specification_id
        ).first()
    except SQLAlchemyError as exc:
        logger.exception("Could not read specification for extraction")
        raise HTTPException(status_code=500, detail="Không thể đọc đặc tả.") from exc
    if specification is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy đặc tả.")
    if specification.type != "functional":
        raise HTTPException(
            status_code=409,
            detail="Chỉ đặc tả chức năng mới sinh được tác nhân và use case.",
        )
    prompt = (
        "Phân tích đặc tả phần mềm sau bằng tiếng Việt. Đề xuất các tác nhân và "
        "use case có căn cứ trực tiếp trong nội dung, không tự bịa nghiệp vụ. "
        "Trả về JSON đúng schema: {\"suggested_actors\":[{\"name\":\"...\"}],"
        "\"suggested_use_cases\":[{\"name\":\"...\",\"description\":\"...\"}]}. "
        "Nếu không có mục phù hợp, trả mảng rỗng.\n\n"
        f"ĐẶC TẢ:\n{_format_specification(specification, index=1)}"
    )
    result = _ai_json(prompt, ExtractActorsUseCasesResult)
    return result


@router.post(
    "/api/projects/{project_id}/extract-actors-usecases-batch",
    response_model=ExtractProjectActorsUseCasesResult,
)
def extract_project_actors_use_cases_batch(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ExtractProjectActorsUseCasesResult:
    _require_project(db, project_id)
    _require_approved_specifications(db, project_id)
    try:
        # Chỉ đặc tả CHỨC NĂNG mới sinh được use case; đặc tả phi chức năng
        # không mô tả hành vi nên nếu trộn vào chỉ khiến AI bịa nghiệp vụ.
        specifications = (
            db.query(Specification)
            .join(UserStory, Specification.user_story_id == UserStory.id)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .filter(
                RawRequirement.project_id == project_id,
                Specification.type == "functional",
            )
            .order_by(Specification.id)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not read project specifications for batch extraction")
        raise HTTPException(status_code=500, detail="Không thể đọc đặc tả của dự án.") from exc
    if not specifications:
        try:
            confirmed_stories = (
                db.query(UserStory)
                .join(
                    RawRequirement,
                    UserStory.requirement_id == RawRequirement.id,
                )
                .filter(
                    RawRequirement.project_id == project_id,
                    RawRequirement.status == "confirmed",
                )
                .order_by(UserStory.id)
                .all()
            )

            if not confirmed_stories:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Dự án chưa có yêu cầu được xác nhận. "
                        "Vui lòng xác nhận yêu cầu trước."
                    ),
                )

            for story in confirmed_stories:
                existing_spec = (
                    db.query(Specification)
                    .filter(
                        Specification.user_story_id == story.id,
                        Specification.type == "functional",
                    )
                    .first()
                )

                if existing_spec is not None:
                    continue

                content = "\n".join([
                    "ĐẶC TẢ CHỨC NĂNG DẪN XUẤT TỪ USER STORY ĐÃ XÁC NHẬN",
                    "Đây là đầu vào mô hình hóa UML, không phải SRS hoàn chỉnh.",
                    f"User Story ID: {story.id}",
                    f"Vai trò: {story.role or ''}",
                    f"Chức năng: {story.feature or ''}",
                    f"Lợi ích: {story.benefit or ''}",
                    f"Tiêu chí chấp nhận: {story.acceptance_criteria or ''}",
                    f"Ghi chú kỹ thuật: {story.technical_notes or ''}",
                ])

                db.add(
                    Specification(
                        user_story_id=story.id,
                        type="functional",
                        content=content,
                        version=1,
                    )
                )

            db.flush()

            specifications = (
                db.query(Specification)
                .join(
                    UserStory,
                    Specification.user_story_id == UserStory.id,
                )
                .join(
                    RawRequirement,
                    UserStory.requirement_id == RawRequirement.id,
                )
                .filter(
                    RawRequirement.project_id == project_id,
                    Specification.type == "functional",
                )
                .order_by(Specification.id)
                .all()
            )

            db.commit()

        except HTTPException:
            db.rollback()
            raise
        except SQLAlchemyError as exc:
            db.rollback()
            logger.exception(
                "Could not derive functional specifications "
                "from confirmed stories"
            )
            raise HTTPException(
                status_code=500,
                detail="Không thể chuẩn bị dữ liệu cho mô hình hóa UML.",
            ) from exc

        if not specifications:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Không tìm thấy đặc tả chức năng hợp lệ. "
                    "Vui lòng kiểm tra lại User Story đã xác nhận."
                ),
            )

    spec_context = "\n\n".join(
        _format_specification(item, index=index)
        for index, item in enumerate(specifications, start=1)
    )
    prompt = (
        "Phân tích tất cả đặc tả phần mềm của dự án bằng tiếng Việt. Tổng hợp "
        "các tác nhân và use case không trùng lặp. Mỗi use case phải gắn với "
        "specification_id phù hợp lấy đúng từ đầu vào. Chỉ đề xuất nội dung có "
        "căn cứ trong đặc tả. Trả JSON đúng schema: "
        "{\"suggested_actors\":[{\"name\":\"...\"}],"
        "\"suggested_use_cases\":[{\"specification_id\":1,\"name\":\"...\","
        "\"description\":\"...\"}]}. Nếu không có đề xuất, trả mảng rỗng.\n\n"
        f"{spec_context}"
    )
    result = _ai_json(prompt, ExtractProjectActorsUseCasesResult)
    valid_spec_ids = {item.id for item in specifications}
    if any(item.specification_id not in valid_spec_ids for item in result.suggested_use_cases):
        raise HTTPException(
            status_code=502,
            detail="AI gắn use case với đặc tả không thuộc dự án.",
        )
    actors = []
    seen_actors: set[str] = set()
    for item in result.suggested_actors:
        normalized = item.name.casefold()
        if normalized not in seen_actors:
            seen_actors.add(normalized)
            actors.append(item)
    use_cases = []
    seen_use_cases: set[tuple[int, str]] = set()
    for item in result.suggested_use_cases:
        key = (item.specification_id, item.name.casefold())
        if key not in seen_use_cases:
            seen_use_cases.add(key)
            use_cases.append(item)
    return ExtractProjectActorsUseCasesResult(
        suggested_actors=actors,
        suggested_use_cases=use_cases,
    )


@router.post(
    "/api/projects/{project_id}/actors-use-cases/batch",
    response_model=SaveActorUseCasesBatchResult,
    status_code=status.HTTP_201_CREATED,
)
def save_project_actor_use_cases_batch(
    project_id: int,
    data: SaveActorUseCasesBatch,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SaveActorUseCasesBatchResult:
    _require_project(db, project_id)
    _require_approved_specifications(db, project_id)
    specification_ids = {item.specification_id for item in data.use_cases}
    try:
        specifications = (
            db.query(Specification.id)
            .join(UserStory, Specification.user_story_id == UserStory.id)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .filter(
                RawRequirement.project_id == project_id,
                Specification.type == "functional",
                Specification.id.in_(specification_ids),
            )
            .all()
        ) if specification_ids else []
        if len(specifications) != len(specification_ids):
            raise HTTPException(
                status_code=422,
                detail="Có đặc tả không thuộc dự án hoặc không phải đặc tả chức năng.",
            )

        actor_by_name: dict[str, Actor] = {}
        for selection in data.actors:
            normalized = selection.name.casefold()
            if normalized in actor_by_name:
                continue
            actor = (
                db.query(Actor)
                .filter(
                    Actor.project_id == project_id,
                    func.lower(Actor.name) == normalized,
                )
                .first()
            )
            if actor is None:
                actor = Actor(project_id=project_id, name=selection.name)
                db.add(actor)
                db.flush()
            actor_by_name[normalized] = actor

        use_case_by_key: dict[tuple[int, str], UseCase] = {}
        for selection in data.use_cases:
            key = (selection.specification_id, selection.name.casefold())
            if key in use_case_by_key:
                continue
            use_case = (
                db.query(UseCase)
                .filter(
                    UseCase.specification_id == selection.specification_id,
                    func.lower(UseCase.name) == selection.name.casefold(),
                )
                .first()
            )
            if use_case is None:
                use_case = UseCase(
                    specification_id=selection.specification_id,
                    name=selection.name,
                    main_flow=_encode_lines([]),
                    alt_flow=_encode_lines([]),
                    exception_flow=_encode_lines([]),
                )
                db.add(use_case)
                db.flush()
            use_case_by_key[key] = use_case

        relation_records: list[UcActorRelation] = []
        for selection in data.relations:
            key = (selection.specification_id, selection.use_case_name.casefold())
            use_case = use_case_by_key.get(key)
            actor = actor_by_name.get(selection.actor_name.casefold())
            if use_case is None or actor is None:
                raise HTTPException(
                    status_code=422,
                    detail="Quan hệ phải tham chiếu actor và use case đã chọn.",
                )
            relation = (
                db.query(UcActorRelation)
                .filter(
                    UcActorRelation.use_case_id == use_case.id,
                    UcActorRelation.actor_id == actor.id,
                )
                .first()
            )
            if relation is None:
                relation = UcActorRelation(
                    use_case_id=use_case.id,
                    actor_id=actor.id,
                    relation_type=selection.relation_type,
                )
                db.add(relation)
            else:
                relation.relation_type = selection.relation_type
            relation_records.append(relation)
        db.commit()
        for record in relation_records:
            db.refresh(record)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not save project actor/use-case batch")
        raise HTTPException(status_code=500, detail="Không thể lưu actor/use case.") from exc

    return SaveActorUseCasesBatchResult(
        actors=[ActorRecord.model_validate(item) for item in actor_by_name.values()],
        use_cases=[_use_case_record(item) for item in use_case_by_key.values()],
        relations=[ActorRelationRecord.model_validate(item) for item in relation_records],
    )


@router.post(
    "/api/projects/{project_id}/actors",
    response_model=ActorRecord,
    status_code=status.HTTP_201_CREATED,
)
def create_actor(
    project_id: int,
    data: ActorCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ActorRecord:
    _require_project(db, project_id)
    try:
        actor = (
            db.query(Actor)
            .filter(
                Actor.project_id == project_id,
                func.lower(Actor.name) == data.name.lower(),
            )
            .first()
        )
        if actor is not None:
            return ActorRecord.model_validate(actor)
        actor = Actor(project_id=project_id, name=data.name)
        db.add(actor)
        db.commit()
        db.refresh(actor)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not create project actor")
        raise HTTPException(status_code=500, detail="Không thể lưu tác nhân.") from exc
    return ActorRecord.model_validate(actor)


@router.get("/api/projects/{project_id}/actors", response_model=list[ActorRecord])
def list_actors(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ActorRecord]:
    _require_project(db, project_id)
    try:
        actors = db.query(Actor).filter(Actor.project_id == project_id).order_by(Actor.id).all()
    except SQLAlchemyError as exc:
        logger.exception("Could not list project actors")
        raise HTTPException(status_code=500, detail="Không thể đọc tác nhân.") from exc
    return [ActorRecord.model_validate(actor) for actor in actors]


@router.patch("/api/actors/{actor_id}", response_model=ActorRecord)
def update_actor(
    actor_id: int,
    data: ActorUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ActorRecord:
    try:
        actor = db.query(Actor).filter(Actor.id == actor_id).first()
        if actor is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy tác nhân.")
        _require_project(db, actor.project_id)
        _require_approved_specifications(db, actor.project_id)
        if data.name is not None:
            duplicate = db.query(Actor.id).filter(
                Actor.project_id == actor.project_id,
                func.lower(Actor.name) == data.name.lower(),
                Actor.id != actor_id,
            ).first()
            if duplicate:
                raise HTTPException(status_code=409, detail="Tên tác nhân đã tồn tại trong dự án.")
            actor.name = data.name
        if data.description is not None:
            actor.description = data.description
        if data.role is not None:
            actor.role = data.role
        if data.main_businesses is not None:
            actor.main_businesses = data.main_businesses
        db.commit()
        db.refresh(actor)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not update actor")
        raise HTTPException(status_code=500, detail="Không thể cập nhật tác nhân.") from exc
    return ActorRecord.model_validate(actor)


@router.delete("/api/actors/{actor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_actor(
    actor_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    try:
        actor = db.query(Actor).filter(Actor.id == actor_id).first()
        if actor is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy tác nhân.")
        _require_project(db, actor.project_id)
        _require_approved_specifications(db, actor.project_id)
        db.query(UcActorRelation).filter(
            UcActorRelation.actor_id == actor_id
        ).delete(synchronize_session=False)
        db.query(TraceLink).filter(
            TraceLink.project_id == actor.project_id,
            ((TraceLink.source_type == "actor") & (TraceLink.source_id == actor_id))
            | ((TraceLink.target_type == "actor") & (TraceLink.target_id == actor_id)),
        ).delete(synchronize_session=False)
        db.delete(actor)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not delete actor")
        raise HTTPException(status_code=500, detail="Không thể xóa tác nhân.") from exc


@router.get(
    "/api/projects/{project_id}/use-cases",
    response_model=list[UseCaseRecord],
)
def list_project_use_cases(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[UseCaseRecord]:
    _require_project(db, project_id)
    try:
        use_cases = (
            db.query(UseCase)
            .join(Specification, UseCase.specification_id == Specification.id)
            .join(UserStory, Specification.user_story_id == UserStory.id)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .filter(RawRequirement.project_id == project_id)
            .order_by(UseCase.id)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not list project use cases")
        raise HTTPException(status_code=500, detail="Không thể đọc use case của dự án.") from exc
    return [_use_case_record(use_case) for use_case in use_cases]


@router.get("/api/use-cases/{use_case_id}", response_model=UseCaseRecord)
def get_use_case(
    use_case_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> UseCaseRecord:
    return _use_case_record(_use_case(db, use_case_id))


@router.post(
    "/api/specifications/{specification_id}/use-cases",
    response_model=UseCaseRecord,
    status_code=status.HTTP_201_CREATED,
)
def create_use_case(
    specification_id: int,
    data: UseCaseCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> UseCaseRecord:
    _project_for_specification(db, specification_id)
    try:
        specification = db.query(Specification).filter(
            Specification.id == specification_id
        ).first()
        if specification is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy đặc tả.")
        if specification.type != "functional":
            raise HTTPException(
                status_code=422,
                detail="Chỉ đặc tả chức năng mới tạo được use case.",
            )
        existing = (
            db.query(UseCase)
            .filter(
                UseCase.specification_id == specification_id,
                func.lower(UseCase.name) == data.name.lower(),
            )
            .first()
        )
        if existing is not None:
            return _use_case_record(existing)
        use_case = UseCase(
            specification_id=specification_id,
            name=data.name,
            main_flow=_encode_lines([]),
            alt_flow=_encode_lines([]),
            exception_flow=_encode_lines([]),
        )
        db.add(use_case)
        db.commit()
        db.refresh(use_case)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not create use case")
        raise HTTPException(status_code=500, detail="Không thể lưu use case.") from exc
    return _use_case_record(use_case)


@router.delete("/api/use-cases/{use_case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_use_case(
    use_case_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    try:
        use_case = db.query(UseCase).filter(UseCase.id == use_case_id).first()
        if use_case is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy use case.")
        project_id = _project_for_use_case(db, use_case_id)
        _require_project(db, project_id)
        _require_approved_specifications(db, project_id)
        db.query(UcActorRelation).filter(
            UcActorRelation.use_case_id == use_case_id
        ).delete(synchronize_session=False)
        diagram_ids = [
            row[0]
            for row in db.query(Diagram.id).filter(
                Diagram.use_case_id == use_case_id
            ).all()
        ]
        if diagram_ids:
            db.query(DiagramRevision).filter(
                DiagramRevision.diagram_id.in_(diagram_ids)
            ).delete(synchronize_session=False)
        db.query(Diagram).filter(Diagram.use_case_id == use_case_id).delete(
            synchronize_session=False
        )
        db.query(TraceLink).filter(
            TraceLink.project_id == project_id,
            ((TraceLink.source_type == "use_case") & (TraceLink.source_id == use_case_id))
            | ((TraceLink.target_type == "use_case") & (TraceLink.target_id == use_case_id)),
        ).delete(synchronize_session=False)
        db.delete(use_case)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not delete use case")
        raise HTTPException(status_code=500, detail="Không thể xóa use case.") from exc


@router.post(
    "/api/use-cases/{use_case_id}/actor-relations",
    response_model=ActorRelationRecord,
)
def create_actor_relation(
    use_case_id: int,
    data: ActorRelationInput,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ActorRelationRecord:
    project_id = _project_for_use_case(db, use_case_id)
    try:
        actor = db.query(Actor).filter(
            Actor.id == data.actor_id,
            Actor.project_id == project_id,
        ).first()
        if actor is None:
            raise HTTPException(
                status_code=422,
                detail="Tác nhân không thuộc cùng dự án với use case.",
            )
        relation = db.query(UcActorRelation).filter(
            UcActorRelation.use_case_id == use_case_id,
            UcActorRelation.actor_id == data.actor_id,
        ).first()
        if relation is None:
            relation = UcActorRelation(
                use_case_id=use_case_id,
                actor_id=data.actor_id,
                relation_type=data.relation_type,
            )
            db.add(relation)
        else:
            relation.relation_type = data.relation_type
        db.commit()
        db.refresh(relation)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not save actor use-case relation")
        raise HTTPException(status_code=500, detail="Không thể lưu quan hệ tác nhân.") from exc
    return ActorRelationRecord.model_validate(relation)


@router.get(
    "/api/use-cases/{use_case_id}/actor-relations",
    response_model=list[ActorRelationRecord],
)
def list_use_case_actor_relations(
    use_case_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ActorRelationRecord]:
    _use_case(db, use_case_id)
    try:
        relations = (
            db.query(UcActorRelation)
            .filter(UcActorRelation.use_case_id == use_case_id)
            .order_by(UcActorRelation.id)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not list use-case actor relations")
        raise HTTPException(status_code=500, detail="Không thể đọc quan hệ tác nhân.") from exc
    return [ActorRelationRecord.model_validate(item) for item in relations]


@router.delete(
    "/api/actor-relations/{relation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_actor_relation(
    relation_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    try:
        relation = db.query(UcActorRelation).filter(
            UcActorRelation.id == relation_id
        ).first()
        if relation is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy quan hệ tác nhân.")
        project_id = _project_for_use_case(db, relation.use_case_id)
        _require_project(db, project_id)
        _require_approved_specifications(db, project_id)
        db.delete(relation)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not delete actor relation")
        raise HTTPException(status_code=500, detail="Không thể xóa quan hệ tác nhân.") from exc


@router.post(
    "/api/projects/{project_id}/diagrams/use-case",
    response_model=DiagramRecord,
    status_code=status.HTTP_201_CREATED,
)
def generate_use_case_diagram(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DiagramRecord:
    project = _require_project(db, project_id)
    _require_approved_specifications(db, project_id)
    try:
        actors = db.query(Actor).filter(Actor.project_id == project_id).order_by(Actor.id).all()
        use_cases = (
            db.query(UseCase)
            .join(Specification, UseCase.specification_id == Specification.id)
            .join(UserStory, Specification.user_story_id == UserStory.id)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .filter(RawRequirement.project_id == project_id)
            .order_by(UseCase.id)
            .all()
        )
        if not actors or not use_cases:
            raise HTTPException(
                status_code=409,
                detail="Cần ít nhất một tác nhân và một use case để sinh biểu đồ.",
            )
        links = (
            db.query(UcActorRelation)
            .join(UseCase, UcActorRelation.use_case_id == UseCase.id)
            .join(Specification, UseCase.specification_id == Specification.id)
            .join(UserStory, Specification.user_story_id == UserStory.id)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .filter(RawRequirement.project_id == project_id)
            .all()
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        logger.exception("Could not load project UML model")
        raise HTTPException(status_code=500, detail="Không thể đọc dữ liệu biểu đồ.") from exc

    actor_aliases = {actor.id: f"A{index + 1}" for index, actor in enumerate(actors)}
    use_case_aliases = {item.id: f"UC{index + 1}" for index, item in enumerate(use_cases)}
    lines = ["@startuml", "left to right direction"]
    lines.extend(
        f'actor "{_quoted(actor.name)}" as {actor_aliases[actor.id]}'
        for actor in actors
    )
    lines.append(f'rectangle "{_quoted(project.name)}" {{')
    lines.extend(
        f'  usecase "{_quoted(item.name)}" as {use_case_aliases[item.id]}'
        for item in use_cases
    )
    lines.append("}")
    relation_arrows = {
        "association": "-->",
        "include": "..>",
        "extend": "..>",
        "generalization": "--|>",
    }
    for relation in links:
        arrow = relation_arrows[relation.relation_type]
        label = (
            f' : <<{relation.relation_type}>>'
            if relation.relation_type != "association"
            else ""
        )
        lines.append(
            f"{actor_aliases[relation.actor_id]} {arrow} "
            f"{use_case_aliases[relation.use_case_id]}{label}"
        )
    lines.append("@enduml")
    source_code = "\n".join(lines)
    diagram = _render_and_save_diagram(
        db, project_id, "use_case", source_code
    )
    return DiagramRecord.model_validate(diagram)


def _generate_scenario_for(
    use_case: UseCase,
    specification: Specification,
    index: int = 1,
) -> UseCaseScenarioSuggestion:
    """Sinh kịch bản cho MỘT use case. Dùng chung cho endpoint đơn và fallback batch.

    Tách riêng để khi batch bỏ sót use case, hệ thống gọi lại đúng một use case
    mà không cần nhân bản prompt ở hai nơi.
    """
    from services.use_case_prompts import build_use_case_scenario_prompt

    prompt = build_use_case_scenario_prompt(
        use_case.name,
        _format_specification(specification, index=index),
    )
    return _ai_json(prompt, UseCaseScenarioSuggestion)

@router.post(
    "/api/use-cases/{use_case_id}/generate-scenario",
    response_model=UseCaseRecord,
)
def generate_use_case_scenario(
    use_case_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> UseCaseRecord:
    use_case = _use_case(db, use_case_id)
    project_id = _project_for_use_case(db, use_case_id)
    _require_approved_specifications(db, project_id)
    try:
        specification = db.query(Specification).filter(
            Specification.id == use_case.specification_id
        ).first()
    except SQLAlchemyError as exc:
        logger.exception("Could not read scenario specification")
        raise HTTPException(status_code=500, detail="Không thể đọc đặc tả liên quan.") from exc
    if specification is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy đặc tả liên quan.")
    result = _generate_scenario_for(use_case, specification)
    use_case.actor = "\n".join(result.actor)
    use_case.description = "\n".join(result.description)
    use_case.preconditions = "\n".join(result.preconditions)
    use_case.minimal_guarantees = "\n".join(result.minimal_guarantees)
    use_case.postconditions = "\n".join(result.postconditions)
    use_case.main_flow = _encode_lines(result.main_flow)
    use_case.alt_flow = _encode_lines(result.alt_flow)
    use_case.exception_flow = _encode_lines(result.exception_flow)
    try:
        db.commit()
        db.refresh(use_case)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not save generated use-case scenario")
        raise HTTPException(status_code=500, detail="Không thể lưu kịch bản use case.") from exc
    return _use_case_record(use_case)


@router.post(
    "/api/projects/{project_id}/use-cases/generate-scenarios-batch",
    response_model=UseCaseScenarioBatchResult,
)
# Trả kèm name/specification_id (lấy từ bản ghi đã nạp sẵn, không thêm truy vấn)
# để mỗi kết quả tự mô tả đầy đủ use case của nó, đồng bộ với UseCaseRecord.
def generate_project_use_case_scenarios_batch(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> UseCaseScenarioBatchResult:
    _require_project(db, project_id)
    _require_approved_specifications(db, project_id)
    try:
        rows = (
            db.query(UseCase, Specification)
            .join(Specification, UseCase.specification_id == Specification.id)
            .join(UserStory, Specification.user_story_id == UserStory.id)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .filter(
                RawRequirement.project_id == project_id,
                (
                    (UseCase.main_flow.is_(None))
                    | (UseCase.main_flow == "[]")
                    | (UseCase.actor.is_(None))
                    | (UseCase.actor == "")
                    | (UseCase.description.is_(None))
                    | (UseCase.description == "")
                    | (UseCase.preconditions.is_(None))
                    | (UseCase.preconditions == "")
                    | (UseCase.minimal_guarantees.is_(None))
                    | (UseCase.minimal_guarantees == "")
                    | (UseCase.postconditions.is_(None))
                    | (UseCase.postconditions == "")
                ),
            )
            .order_by(UseCase.id)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not list use cases without main flow")
        raise HTTPException(status_code=500, detail="Không thể đọc use case cần sinh kịch bản.") from exc
    if not rows:
        return UseCaseScenarioBatchResult(results=[])

    inputs = "\n\n".join(
        f"USE_CASE_ID: {use_case.id}\nTÊN: {use_case.name}\n"
        f"ĐẶC TẢ:\n{_format_specification(specification, index=index)}"
        for index, (use_case, specification) in enumerate(rows, start=1)
    )
    valid_ids = [use_case.id for use_case, _ in rows]
    prompt = (
        "Sinh kịch bản cho tất cả use case dưới đây bằng tiếng Việt, chỉ dựa vào "
        "tên use case và đặc tả tương ứng. Mỗi main_flow có ít nhất một bước. "
        "Không bịa dữ kiện; ghi rõ điểm cần xác nhận nếu thông tin chưa đủ. "
        "Trả JSON theo schema: {\"results\":[{\"use_case_id\":1,"
        "\"actor\":[\"...\"],\"description\":[\"...\"],"
        "\"preconditions\":[\"...\"],\"minimal_guarantees\":[\"...\"],"
        "\"postconditions\":[\"...\"],\"main_flow\":[\"...\"],"
        "\"alt_flow\":[],\"exception_flow\":[]}]}. "
        f"Phải trả ĐÚNG {len(valid_ids)} kết quả, mỗi kết quả ứng với một "
        "USE_CASE_ID sau và dùng nguyên giá trị số đó làm use_case_id: "
        f"{', '.join(str(use_case_id) for use_case_id in valid_ids)}.\n\n"
        f"{inputs}"
    )
    result = _ai_json(prompt, UseCaseScenarioBatchResult)

    # Model nhỏ (qwen2.5:3b) hay bỏ sót hoặc trả trùng ID khi có nhiều use case.
    # Thay vì báo lỗi 502 cho người dùng, giữ những kết quả hợp lệ rồi sinh bù
    # riêng cho từng use case còn thiếu bằng endpoint đơn (đã được kiểm thử).
    by_id = {use_case.id: use_case for use_case, _ in rows}
    specification_by_id = {use_case.id: specification for use_case, specification in rows}
    accepted: dict[int, UseCaseScenarioBatchItem] = {}
    for item in result.results:
        if item.use_case_id in by_id and item.use_case_id not in accepted:
            # AI chỉ trả use_case_id + kịch bản; điền name/specification_id từ
            # bản ghi đã nạp sẵn để item tự mô tả đủ, khớp UseCaseRecord.
            matched = by_id[item.use_case_id]
            accepted[item.use_case_id] = UseCaseScenarioBatchItem(
                use_case_id=item.use_case_id,
                name=matched.name,
                specification_id=matched.specification_id,
                actor=item.actor,
                description=item.description,
                preconditions=item.preconditions,
                minimal_guarantees=item.minimal_guarantees,
                postconditions=item.postconditions,
                main_flow=item.main_flow,
                alt_flow=item.alt_flow,
                exception_flow=item.exception_flow,
            )

    missing_ids = [use_case.id for use_case, _ in rows if use_case.id not in accepted]
    for index, use_case_id in enumerate(missing_ids, start=1):
        use_case = by_id[use_case_id]
        logger.info(
            "Batch bo sot use case %s, sinh bu bang mot yeu cau rieng.", use_case_id
        )
        fallback = _generate_scenario_for(
            use_case, specification_by_id[use_case_id], index=index
        )
        accepted[use_case_id] = UseCaseScenarioBatchItem(
            use_case_id=use_case_id,
            name=use_case.name,
            specification_id=use_case.specification_id,
            actor=fallback.actor,
            description=fallback.description,
            preconditions=fallback.preconditions,
            minimal_guarantees=fallback.minimal_guarantees,
            postconditions=fallback.postconditions,
            main_flow=fallback.main_flow,
            alt_flow=fallback.alt_flow,
            exception_flow=fallback.exception_flow,
        )

    ordered_results = [accepted[use_case.id] for use_case, _ in rows]
    result = UseCaseScenarioBatchResult(results=ordered_results)
    try:
        for item in ordered_results:
            use_case = by_id[item.use_case_id]
            use_case.actor = "\n".join(item.actor)
            use_case.description = "\n".join(item.description)
            use_case.preconditions = "\n".join(item.preconditions)
            use_case.minimal_guarantees = "\n".join(item.minimal_guarantees)
            use_case.postconditions = "\n".join(item.postconditions)
            use_case.main_flow = _encode_lines(item.main_flow)
            use_case.alt_flow = _encode_lines(item.alt_flow)
            use_case.exception_flow = _encode_lines(item.exception_flow)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not save use-case scenario batch")
        raise HTTPException(status_code=500, detail="Không thể lưu kịch bản.") from exc
    return result


@router.patch("/api/use-cases/{use_case_id}", response_model=UseCaseRecord)
def update_use_case(
    use_case_id: int,
    data: UseCaseUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> UseCaseRecord:
    use_case = _use_case(db, use_case_id)
    project_id = _project_for_use_case(db, use_case_id)
    _require_approved_specifications(db, project_id)
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Cần cung cấp ít nhất một trường để cập nhật.")
    try:
        if data.name is not None:
            duplicate = db.query(UseCase.id).filter(
                UseCase.specification_id == use_case.specification_id,
                func.lower(UseCase.name) == data.name.lower(),
                UseCase.id != use_case_id,
            ).first()
            if duplicate:
                raise HTTPException(
                    status_code=409,
                    detail="Tên use case đã tồn tại trong cùng đặc tả.",
                )
            use_case.name = data.name
        for field in ("actor", "description", "preconditions", "minimal_guarantees", "postconditions"):
            value = getattr(data, field)
            if value is not None:
                setattr(use_case, field, value)
        if data.main_flow is not None:
            use_case.main_flow = _encode_lines(data.main_flow)
        if data.alt_flow is not None:
            use_case.alt_flow = _encode_lines(data.alt_flow)
        if data.exception_flow is not None:
            use_case.exception_flow = _encode_lines(data.exception_flow)
        db.commit()
        db.refresh(use_case)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not update use-case scenario")
        raise HTTPException(status_code=500, detail="Không thể cập nhật kịch bản.") from exc
    return _use_case_record(use_case)


@router.post(
    "/api/use-cases/{use_case_id}/diagrams",
    response_model=DiagramRecord,
    status_code=status.HTTP_201_CREATED,
)
def generate_interaction_diagram(
    use_case_id: int,
    data: InteractionDiagramInput,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DiagramRecord:
    use_case = _use_case(db, use_case_id)
    project_id = _project_for_use_case(db, use_case_id)
    _require_approved_specifications(db, project_id)
    main_flow = _decode_lines(use_case.main_flow)
    alt_flow = _decode_lines(use_case.alt_flow)
    if not main_flow and not alt_flow:
        raise HTTPException(
            status_code=409,
            detail="Hãy sinh hoặc lưu kịch bản trước khi tạo biểu đồ tương tác.",
        )
    try:
        actors = (
            db.query(Actor)
            .join(UcActorRelation, UcActorRelation.actor_id == Actor.id)
            .filter(UcActorRelation.use_case_id == use_case_id)
            .order_by(Actor.id)
            .all()
        )
        # Phương án dự phòng: use case chưa gán tác nhân tường minh thì dùng tác
        # nhân đầu tiên của dự án, thay vì chặn người dùng (biểu đồ tương tác luôn
        # cần một tác nhân khởi động).
        if not actors:
            actors = (
                db.query(Actor)
                .filter(Actor.project_id == project_id)
                .order_by(Actor.id)
                .all()
            )
    except SQLAlchemyError as exc:
        logger.exception("Could not read use-case actors")
        raise HTTPException(status_code=500, detail="Không thể đọc tác nhân của use case.") from exc
    if not actors:
        raise HTTPException(
            status_code=409,
            detail=(
                "Dự án chưa có tác nhân nào. Hãy lưu tác nhân và use case ở Bước 1 "
                "trước khi sinh biểu đồ tương tác."
            ),
        )
    actor_name = actors[0].name
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
    except SQLAlchemyError as exc:
        logger.exception("Could not read interaction diagram project")
        raise HTTPException(status_code=500, detail="Không thể đọc dự án.") from exc
    if project is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án của use case.")
    if data.diagram_type == "sequence":
        from services.sequence_diagram import build_sequence_diagram_source

        source_code = build_sequence_diagram_source(
            actor_name,
            project.name,
            use_case.name,
            main_flow,
            alt_flow,
            _decode_lines(use_case.exception_flow),
        )
    else:
        lines = [
            "@startuml",
            f'object "{_quoted(actor_name)}" as A1',
            f'object "{_quoted(project.name)}" as SYS',
        ]
        for index, item in enumerate(main_flow, start=1):
            lines.append(f'A1 -> SYS : {index}. {_quoted(item)}')
        for index, item in enumerate(alt_flow, start=1):
            lines.append(f'A1 ..> SYS : Luồng phụ {index}: {_quoted(item)}')
        for index, item in enumerate(_decode_lines(use_case.exception_flow), start=1):
            lines.append(f'SYS ..> A1 : Ngoại lệ {index}: {_quoted(item)}')
        lines.extend([f'title {_quoted(use_case.name)}', "@enduml"])
        source_code = "\n".join(lines)
    diagram = _render_and_save_diagram(
        db,
        project_id,
        data.diagram_type,
        source_code,
        use_case_id=use_case_id,
    )
    return DiagramRecord.model_validate(diagram)


@router.post(
    "/api/projects/{project_id}/use-cases/generate-interaction-diagrams-batch",
    response_model=list[DiagramRecord],
    status_code=status.HTTP_201_CREATED,
)
def generate_project_interaction_diagrams_batch(
    project_id: int,
    data: InteractionDiagramInput,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[DiagramRecord]:
    _require_project(db, project_id)
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        use_cases = (
            db.query(UseCase)
            .join(Specification, UseCase.specification_id == Specification.id)
            .join(UserStory, Specification.user_story_id == UserStory.id)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .filter(RawRequirement.project_id == project_id)
            .order_by(UseCase.id)
            .all()
        )
        diagrams = (
            db.query(Diagram.use_case_id)
            .filter(
                Diagram.project_id == project_id,
                Diagram.type == data.diagram_type,
                Diagram.use_case_id.is_not(None),
            )
            .all()
        )
        # Tác nhân của cả dự án, dùng làm phương án dự phòng cho use case chưa được
        # gán tác nhân tường minh (dữ liệu cũ, hoặc người dùng chỉ lưu use case).
        project_actors = (
            db.query(Actor)
            .filter(Actor.project_id == project_id)
            .order_by(Actor.id)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not load project data for interaction diagram batch")
        raise HTTPException(status_code=500, detail="Không thể đọc dữ liệu biểu đồ tương tác.") from exc
    if project is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")
    existing_use_case_ids = {row[0] for row in diagrams}
    candidates = [
        item
        for item in use_cases
        if _decode_lines(item.main_flow) and item.id not in existing_use_case_ids
    ]
    sources: list[tuple[UseCase, str]] = []
    for use_case in candidates:
        try:
            actors = (
                db.query(Actor)
                .join(UcActorRelation, UcActorRelation.actor_id == Actor.id)
                .filter(UcActorRelation.use_case_id == use_case.id)
                .order_by(Actor.id)
                .all()
            )
        except SQLAlchemyError as exc:
            logger.exception("Could not load actor for use case %s", use_case.id)
            raise HTTPException(status_code=500, detail="Không thể đọc tác nhân của use case.") from exc
        sources.append((
            use_case,
            _interaction_diagram_source(
                use_case, project, actors, data.diagram_type, project_actors
            ),
        ))

    generated: list[Diagram] = []
    renderer_unavailable = False
    for use_case, source_code in sources:
        try:
            image_url = render_plantuml(source_code)
        except PlantUMLRenderError:
            image_url = None
            renderer_unavailable = True
        generated.append(
            _new_project_diagram(
                db,
                project_id,
                data.diagram_type,
                source_code,
                image_url,
                use_case_id=use_case.id,
            )
        )
    if renderer_unavailable:
        raise HTTPException(
            status_code=503,
            detail=(
                "Một hoặc nhiều mã biểu đồ đã lưu nhưng chưa thể render ảnh. "
                "Cần cấu hình PlantUML render service."
            ),
        )
    return [DiagramRecord.model_validate(item) for item in generated]


@router.post(
    "/api/projects/{project_id}/classes",
    response_model=ClassEntityRecord,
    status_code=status.HTTP_201_CREATED,
)
def create_class(
    project_id: int,
    data: ClassCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ClassEntityRecord:
    _require_project(db, project_id)
    _require_approved_specifications(db, project_id)
    try:
        if db.query(ClassEntity.id).filter(
            ClassEntity.project_id == project_id,
            func.lower(ClassEntity.name) == data.name.lower(),
        ).first():
            raise HTTPException(status_code=409, detail="Tên lớp đã tồn tại trong dự án.")
        entity = ClassEntity(
            project_id=project_id,
            name=data.name,
            attributes=_encode_lines(data.attributes),
            methods=_encode_lines(data.methods),
        )
        db.add(entity)
        db.commit()
        db.refresh(entity)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not create project class")
        raise HTTPException(status_code=500, detail="Không thể tạo lớp.") from exc
    return ClassEntityRecord(
        id=entity.id,
        project_id=entity.project_id,
        name=entity.name,
        attributes=_decode_lines(entity.attributes),
        methods=_decode_lines(entity.methods),
    )


@router.get(
    "/api/projects/{project_id}/classes",
    response_model=list[ClassEntityRecord],
)
def list_project_classes(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ClassEntityRecord]:
    _require_project(db, project_id)
    try:
        entities = (
            db.query(ClassEntity)
            .filter(ClassEntity.project_id == project_id)
            .order_by(ClassEntity.id)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not list project classes")
        raise HTTPException(status_code=500, detail="Không thể đọc lớp của dự án.") from exc
    return [
        ClassEntityRecord(
            id=item.id,
            project_id=item.project_id,
            name=item.name,
            attributes=_decode_lines(item.attributes),
            methods=_decode_lines(item.methods),
        )
        for item in entities
    ]


@router.patch("/api/classes/{class_id}", response_model=ClassEntityRecord)
def update_class(
    class_id: int,
    data: ClassUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ClassEntityRecord:
    try:
        entity = db.query(ClassEntity).filter(ClassEntity.id == class_id).first()
        if entity is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy lớp.")
        _require_project(db, entity.project_id)
        _require_approved_specifications(db, entity.project_id)
        changes = data.model_dump(exclude_unset=True)
        if not changes:
            raise HTTPException(status_code=422, detail="Cần cung cấp ít nhất một trường để cập nhật.")
        if data.name is not None:
            if db.query(ClassEntity.id).filter(
                ClassEntity.project_id == entity.project_id,
                func.lower(ClassEntity.name) == data.name.lower(),
                ClassEntity.id != class_id,
            ).first():
                raise HTTPException(status_code=409, detail="Tên lớp đã tồn tại trong dự án.")
            entity.name = data.name
        if data.attributes is not None:
            entity.attributes = _encode_lines(data.attributes)
        if data.methods is not None:
            entity.methods = _encode_lines(data.methods)
        db.commit()
        db.refresh(entity)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not update class")
        raise HTTPException(status_code=500, detail="Không thể cập nhật lớp.") from exc
    return ClassEntityRecord(
        id=entity.id,
        project_id=entity.project_id,
        name=entity.name,
        attributes=_decode_lines(entity.attributes),
        methods=_decode_lines(entity.methods),
    )


@router.delete("/api/classes/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_class(
    class_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    try:
        entity = db.query(ClassEntity).filter(ClassEntity.id == class_id).first()
        if entity is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy lớp.")
        _require_project(db, entity.project_id)
        _require_approved_specifications(db, entity.project_id)
        db.query(ClassRelation).filter(
            (ClassRelation.class_a_id == class_id)
            | (ClassRelation.class_b_id == class_id)
        ).delete(synchronize_session=False)
        db.query(TraceLink).filter(
            TraceLink.project_id == entity.project_id,
            (
                (TraceLink.source_type.in_(["class", "class_entity"]))
                & (TraceLink.source_id == class_id)
            )
            | (
                (TraceLink.target_type.in_(["class", "class_entity"]))
                & (TraceLink.target_id == class_id)
            ),
        ).delete(synchronize_session=False)
        db.delete(entity)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not delete class")
        raise HTTPException(status_code=500, detail="Không thể xóa lớp.") from exc


@router.post(
    "/api/classes/{class_id}/relations",
    response_model=ClassRelationRecord,
    status_code=status.HTTP_201_CREATED,
)
def create_class_relation(
    class_id: int,
    data: ClassRelationInput,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ClassRelationRecord:
    try:
        class_a = db.query(ClassEntity).filter(ClassEntity.id == class_id).first()
        class_b = db.query(ClassEntity).filter(ClassEntity.id == data.class_b_id).first()
        if class_a is None or class_b is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy một trong các lớp.")
        if class_a.project_id != class_b.project_id:
            raise HTTPException(status_code=422, detail="Hai lớp phải thuộc cùng một dự án.")
        _require_project(db, class_a.project_id)
        _require_approved_specifications(db, class_a.project_id)
        if class_a.id == class_b.id:
            raise HTTPException(status_code=422, detail="Không thể tạo quan hệ lớp với chính nó.")
        relation = ClassRelation(
            class_a_id=class_a.id,
            class_b_id=class_b.id,
            relation_type=data.relation_type,
        )
        db.add(relation)
        db.commit()
        db.refresh(relation)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not create class relation")
        raise HTTPException(status_code=500, detail="Không thể tạo quan hệ lớp.") from exc
    return ClassRelationRecord(
        id=relation.id,
        class_a_id=relation.class_a_id,
        class_b_id=relation.class_b_id,
        relation_type=relation.relation_type or "",
    )


@router.get(
    "/api/projects/{project_id}/class-relations",
    response_model=list[ClassRelationRecord],
)
def list_project_class_relations(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ClassRelationRecord]:
    _require_project(db, project_id)
    try:
        relations = (
            db.query(ClassRelation)
            .join(ClassEntity, ClassRelation.class_a_id == ClassEntity.id)
            .filter(ClassEntity.project_id == project_id)
            .order_by(ClassRelation.id)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not list project class relations")
        raise HTTPException(status_code=500, detail="Không thể đọc quan hệ lớp.") from exc
    return [
        ClassRelationRecord(
            id=item.id,
            class_a_id=item.class_a_id,
            class_b_id=item.class_b_id,
            relation_type=item.relation_type or "",
        )
        for item in relations
    ]


@router.delete(
    "/api/class-relations/{relation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_class_relation(
    relation_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    try:
        relation = db.query(ClassRelation).filter(
            ClassRelation.id == relation_id
        ).first()
        if relation is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy quan hệ lớp.")
        class_a = db.query(ClassEntity).filter(ClassEntity.id == relation.class_a_id).first()
        if class_a is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy lớp thuộc quan hệ.")
        _require_project(db, class_a.project_id)
        _require_approved_specifications(db, class_a.project_id)
        db.delete(relation)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not delete class relation")
        raise HTTPException(status_code=500, detail="Không thể xóa quan hệ lớp.") from exc


@router.post(
    "/api/projects/{project_id}/generate-classes",
    response_model=list[ClassEntityRecord],
)
def generate_classes(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ClassEntityRecord]:
    _require_project(db, project_id)
    try:
        rows = (
            db.query(UseCase, Specification)
            .join(Specification, UseCase.specification_id == Specification.id)
            .join(UserStory, Specification.user_story_id == UserStory.id)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .filter(RawRequirement.project_id == project_id)
            .order_by(UseCase.id)
            .all()
        )
        # Lớp được suy luận từ nghiệp vụ, tức đặc tả CHỨC NĂNG; đặc tả phi
        # chức năng không mô tả thực thể nên không đưa vào prompt.
        specifications = (
            db.query(Specification)
            .join(UserStory, Specification.user_story_id == UserStory.id)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .filter(
                RawRequirement.project_id == project_id,
                Specification.type == "functional",
            )
            .order_by(Specification.id)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not read class diagram source material")
        raise HTTPException(status_code=500, detail="Không thể đọc dữ liệu mô hình lớp.") from exc
    if not rows:
        raise HTTPException(
            status_code=409,
            detail="Cần ít nhất một use case để suy luận biểu đồ lớp.",
        )
    case_context = "\n".join(
        f"Use case: {item.name}\nLuồng chính: {'; '.join(_decode_lines(item.main_flow))}\n"
        f"Luồng phụ: {'; '.join(_decode_lines(item.alt_flow))}\n"
        f"Ngoại lệ: {'; '.join(_decode_lines(item.exception_flow))}"
        for item, _ in rows
    )
    spec_context = "\n\n".join(
        _format_specification(item, index=index)
        for index, item in enumerate(specifications, start=1)
    )
    from services.uml_prompts import build_class_diagram_prompt

    prompt = build_class_diagram_prompt(case_context, spec_context)
    result = _ai_json(prompt, ClassDiagramSuggestion)
    if not result.classes:
        raise HTTPException(status_code=502, detail="AI không đề xuất được lớp nào.")

    by_name: dict[str, ClassEntity] = {}
    try:
        existing = db.query(ClassEntity).filter(ClassEntity.project_id == project_id).all()
        by_name = {item.name.casefold(): item for item in existing}
        persisted_classes: list[ClassEntity] = []
        for suggestion in result.classes:
            class_entity = by_name.get(suggestion.name.casefold())
            if class_entity is None:
                class_entity = ClassEntity(project_id=project_id, name=suggestion.name)
                db.add(class_entity)
            class_entity.attributes = _encode_lines(suggestion.attributes)
            class_entity.methods = _encode_lines(suggestion.methods)
            by_name[suggestion.name.casefold()] = class_entity
            persisted_classes.append(class_entity)
        db.flush()
        class_ids = [item.id for item in existing]
        class_ids.extend(item.id for item in persisted_classes if item.id not in class_ids)
        if class_ids:
            db.query(ClassRelation).filter(
                ClassRelation.class_a_id.in_(class_ids)
                | ClassRelation.class_b_id.in_(class_ids)
            ).delete(synchronize_session=False)
        for relation in result.relations:
            class_a = by_name.get(relation.class_a.casefold())
            class_b = by_name.get(relation.class_b.casefold())
            if class_a is not None and class_b is not None and class_a.id != class_b.id:
                db.add(
                    ClassRelation(
                        class_a_id=class_a.id,
                        class_b_id=class_b.id,
                        relation_type=relation.relation_type,
                    )
                )
        db.commit()
        for item in persisted_classes:
            db.refresh(item)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not persist inferred class entities")
        raise HTTPException(status_code=500, detail="Không thể lưu mô hình lớp.") from exc

    return [
        ClassEntityRecord(
            id=item.id,
            project_id=item.project_id,
            name=item.name,
            attributes=_decode_lines(item.attributes),
            methods=_decode_lines(item.methods),
        )
        for item in persisted_classes
    ]


@router.post(
    "/api/projects/{project_id}/diagrams/class",
    response_model=DiagramRecord,
    status_code=status.HTTP_201_CREATED,
)
def create_class_diagram(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DiagramRecord:
    _require_project(db, project_id)
    _require_approved_specifications(db, project_id)
    try:
        classes = (
            db.query(ClassEntity)
            .filter(ClassEntity.project_id == project_id)
            .order_by(ClassEntity.id)
            .all()
        )
        relations = (
            db.query(ClassRelation)
            .join(ClassEntity, ClassRelation.class_a_id == ClassEntity.id)
            .filter(ClassEntity.project_id == project_id)
            .order_by(ClassRelation.id)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not read classes for class diagram")
        raise HTTPException(status_code=500, detail="Không thể đọc mô hình lớp.") from exc
    if not classes:
        raise HTTPException(
            status_code=409,
            detail="Hãy tạo hoặc suy luận lớp trước khi sinh biểu đồ.",
        )
    source_code = _class_diagram_source(classes, relations)
    diagram = _render_and_save_diagram(db, project_id, "class", source_code)
    return DiagramRecord.model_validate(diagram)


@router.get(
    "/api/projects/{project_id}/diagrams",
    response_model=list[DiagramRecord],
)
def list_project_diagrams(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[DiagramRecord]:
    _require_project(db, project_id)
    try:
        diagrams = (
            db.query(Diagram)
            .filter(Diagram.project_id == project_id)
            .order_by(Diagram.id)
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not list project diagrams")
        raise HTTPException(status_code=500, detail="Không thể đọc biểu đồ của dự án.") from exc
    return [DiagramRecord.model_validate(item) for item in diagrams]


@router.get("/api/diagrams/{diagram_id}", response_model=DiagramRecord)
def get_diagram(
    diagram_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DiagramRecord:
    try:
        diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    except SQLAlchemyError as exc:
        logger.exception("Could not read diagram")
        raise HTTPException(status_code=500, detail="Không thể đọc biểu đồ.") from exc
    if diagram is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy biểu đồ.")
    return DiagramRecord.model_validate(diagram)


@router.patch("/api/diagrams/{diagram_id}", response_model=DiagramRecord)
def update_diagram(
    diagram_id: int,
    data: DiagramUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DiagramRecord:
    try:
        diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    except SQLAlchemyError as exc:
        logger.exception("Could not read diagram to update")
        raise HTTPException(status_code=500, detail="Không thể đọc biểu đồ.") from exc
    if diagram is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy biểu đồ.")
    _require_project(db, diagram.project_id)
    _require_approved_specifications(db, diagram.project_id)
    updated = _render_and_update_diagram(db, diagram, data.source_code)
    return DiagramRecord.model_validate(updated)


@router.get(
    "/api/diagrams/{diagram_id}/revisions",
    response_model=list[DiagramRevisionRecord],
)
def list_diagram_revisions(
    diagram_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[DiagramRevisionRecord]:
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if diagram is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy biểu đồ.")

    _require_project(db, diagram.project_id)

    try:
        revisions = (
            db.query(DiagramRevision)
            .filter(DiagramRevision.diagram_id == diagram_id)
            .order_by(DiagramRevision.version.desc())
            .all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not list diagram revisions")
        raise HTTPException(
            status_code=500,
            detail="Không thể đọc lịch sử biểu đồ.",
        ) from exc

    return [
        DiagramRevisionRecord.model_validate(revision)
        for revision in revisions
    ]

@router.post(
    "/api/diagrams/{diagram_id}/revisions/{revision_id}/restore",
    response_model=DiagramRecord,
)
def restore_diagram_revision(
    diagram_id: int,
    revision_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DiagramRecord:
    diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
    if diagram is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy biểu đồ.")

    _require_project(db, diagram.project_id)
    _require_approved_specifications(db, diagram.project_id)

    revision = (
        db.query(DiagramRevision)
        .filter(
            DiagramRevision.id == revision_id,
            DiagramRevision.diagram_id == diagram_id,
        )
        .first()
    )
    if revision is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy phiên bản của biểu đồ này.",
        )

    try:
        image_url = render_plantuml(revision.source_code)
    except PlantUMLRenderError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Không thể khôi phục vì mã PlantUML không render được: {exc}",
        ) from exc

    diagram.source_code = revision.source_code
    diagram.image_url = image_url
    diagram.version = (diagram.version or 0) + 1

    db.add(
        DiagramRevision(
            diagram_id=diagram.id,
            version=diagram.version,
            source_code=diagram.source_code,
            image_url=diagram.image_url,
            change_type="restore",
        )
    )

    try:
        db.commit()
        db.refresh(diagram)
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not restore diagram revision")
        raise HTTPException(
            status_code=500,
            detail="Không thể khôi phục phiên bản biểu đồ.",
        ) from exc

    return DiagramRecord.model_validate(diagram)

@router.delete("/api/diagrams/{diagram_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_diagram(
    diagram_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    try:
        diagram = db.query(Diagram).filter(Diagram.id == diagram_id).first()
        if diagram is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy biểu đồ.")
        _require_project(db, diagram.project_id)
        _require_approved_specifications(db, diagram.project_id)
        db.query(TraceLink).filter(
            TraceLink.project_id == diagram.project_id,
            ((TraceLink.source_type == "diagram") & (TraceLink.source_id == diagram_id))
            | ((TraceLink.target_type == "diagram") & (TraceLink.target_id == diagram_id)),
        ).delete(synchronize_session=False)
        db.query(DiagramRevision).filter(
            DiagramRevision.diagram_id == diagram_id
        ).delete(synchronize_session=False)
        db.delete(diagram)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Could not delete diagram")
        raise HTTPException(status_code=500, detail="Không thể xóa biểu đồ.") from exc


@router.get(
    "/api/projects/{project_id}/uml-state",
    response_model=ProjectUmlState,
)
def get_project_uml_state(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ProjectUmlState:
    _require_project(db, project_id)
    try:
        actors = db.query(Actor).filter(Actor.project_id == project_id).order_by(Actor.id).all()
        use_cases = (
            db.query(UseCase)
            .join(Specification, UseCase.specification_id == Specification.id)
            .join(UserStory, Specification.user_story_id == UserStory.id)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .filter(RawRequirement.project_id == project_id)
            .order_by(UseCase.id)
            .all()
        )
        relations = (
            db.query(UcActorRelation)
            .join(UseCase, UcActorRelation.use_case_id == UseCase.id)
            .join(Specification, UseCase.specification_id == Specification.id)
            .join(UserStory, Specification.user_story_id == UserStory.id)
            .join(RawRequirement, UserStory.requirement_id == RawRequirement.id)
            .filter(RawRequirement.project_id == project_id)
            .order_by(UcActorRelation.id)
            .all()
        )
        diagrams = (
            db.query(Diagram)
            .filter(Diagram.project_id == project_id)
            .order_by(Diagram.id)
            .all()
        )
        classes = db.query(ClassEntity).filter(
            ClassEntity.project_id == project_id
        ).order_by(ClassEntity.id).all()
        class_ids = [item.id for item in classes]
        class_relations = (
            db.query(ClassRelation)
            .filter(
                ClassRelation.class_a_id.in_(class_ids)
                | ClassRelation.class_b_id.in_(class_ids)
            )
            .order_by(ClassRelation.id)
            .all()
            if class_ids
            else []
        )
    except SQLAlchemyError as exc:
        logger.exception("Could not load project UML state")
        raise HTTPException(status_code=500, detail="Không thể tải dữ liệu UML của dự án.") from exc
    return ProjectUmlState(
        actors=[ActorRecord.model_validate(item) for item in actors],
        use_cases=[_use_case_record(item) for item in use_cases],
        relations=[ActorRelationRecord.model_validate(item) for item in relations],
        diagrams=[DiagramRecord.model_validate(item) for item in diagrams],
        classes=[
            ClassEntityRecord(
                id=item.id,
                project_id=item.project_id,
                name=item.name,
                attributes=_decode_lines(item.attributes),
                methods=_decode_lines(item.methods),
            )
            for item in classes
        ],
        class_relations=[
            {
                "id": item.id,
                "class_a_id": item.class_a_id,
                "class_b_id": item.class_b_id,
                "relation_type": item.relation_type or "association",
            }
            for item in class_relations
        ],
    )
