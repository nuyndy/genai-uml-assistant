import json
import re
import logging
from fastapi.encoders import jsonable_encoder
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from routers.uml import parse_plantuml
from database.db import get_db
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
    SrsDocument,
    Specification,
    SpecificationApproval,
    TraceLink,
    UcActorRelation,
    UseCase,
    User,
    UserStory,
)
from routers.auth import get_current_user
router = APIRouter(prefix="/api/projects", tags=["baseline-traceability"])
logger = logging.getLogger(__name__)
def _owned_project(
    project_id: int,
    db: Session,
    user: User,
) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy project.")
    # Chỉ chủ sở hữu đã xác thực mới được thao tác baseline/traceability.
    # Project không có owner cũng không được coi là công khai.
    if project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy project hoặc bạn không có quyền truy cập.")
    return project

def _serialize(row: Any) -> dict[str, Any]:
    data = {
        column.key: getattr(row, column.key)
        for column in inspect(row).mapper.column_attrs
    }
    return jsonable_encoder(data)

def _project_snapshot(db: Session, project_id: int) -> dict[str, Any]:
    snapshot: dict[str, Any] = {"project_id": project_id, "entities": {}}
    direct_models = [
        RawRequirement,
        Actor,
        ClassEntity,
        Diagram,
        GlossaryTerm,
        SrsDocument,
        EntityRevision,
        TraceLink,
    ]
    for model in direct_models:
        rows = (
            db.query(model)
            .filter(model.project_id == project_id)
            .order_by(model.id)
            .all()
        )
        snapshot["entities"][model.__tablename__] = [
            _serialize(row) for row in rows
        ]
    
    # Lấy User Story thuộc các yêu cầu của dự án.
    requirement_ids = [
        row.id
        for row in db.query(RawRequirement.id)
        .filter(RawRequirement.project_id == project_id)
        .all()
    ]

    stories = (
        db.query(UserStory)
        .filter(UserStory.requirement_id.in_(requirement_ids))
        .order_by(UserStory.id)
        .all()
        if requirement_ids else []
    )

    story_ids = [story.id for story in stories]

    # Lấy đặc tả theo project_id.
    project_specs = (
        db.query(Specification)
        .filter(Specification.project_id == project_id)
        .order_by(Specification.id)
        .all()
    )

    # Lấy thêm đặc tả được liên kết qua User Story.
    story_specs = (
        db.query(Specification)
        .filter(Specification.user_story_id.in_(story_ids))
        .order_by(Specification.id)
        .all()
        if story_ids else []
    )

    # Gộp hai nhóm, tránh trùng đặc tả.
    specs_by_id = {
        spec.id: spec
        for spec in project_specs + story_specs
    }
    project_specs = sorted(
        specs_by_id.values(),
        key=lambda spec: spec.id,
    )

    snapshot["entities"]["specification"] = [
        _serialize(row) for row in project_specs
    ]
    
    spec_ids = [row.id for row in project_specs]
    use_cases = (
        db.query(UseCase)
        .filter(UseCase.specification_id.in_(spec_ids))
        .order_by(UseCase.id)
        .all()
        if spec_ids else []
    )
    snapshot["entities"]["use_case"] = [
        _serialize(row) for row in use_cases
    ]
    use_case_ids = [row.id for row in use_cases]
    relations = (
        db.query(UcActorRelation)
        .filter(UcActorRelation.use_case_id.in_(use_case_ids))
        .order_by(UcActorRelation.id)
        .all()
        if use_case_ids else []
    )
    snapshot["entities"]["uc_actor_relation"] = [
        _serialize(row) for row in relations
    ]
    requirement_ids = [
        row.id
        for row in db.query(RawRequirement.id)
        .filter(RawRequirement.project_id == project_id)
        .all()
    ]
    stories = (
        db.query(UserStory)
        .filter(UserStory.requirement_id.in_(requirement_ids))
        .order_by(UserStory.id)
        .all()
        if requirement_ids else []
    )
    snapshot["entities"]["user_story"] = [
        _serialize(row) for row in stories
    ]
    class_ids = [
        row.id
        for row in db.query(ClassEntity.id)
        .filter(ClassEntity.project_id == project_id)
        .all()
    ]
    class_relations = (
        db.query(ClassRelation)
        .filter(
            ClassRelation.class_a_id.in_(class_ids),
            ClassRelation.class_b_id.in_(class_ids),
        )
        .order_by(ClassRelation.id)
        .all()
        if class_ids else []
    )
    snapshot["entities"]["class_relation"] = [
        _serialize(row) for row in class_relations
    ]
    diagram_ids = [
        row.id
        for row in db.query(Diagram.id)
        .filter(Diagram.project_id == project_id)
        .all()
    ]
    revisions = (
        db.query(DiagramRevision)
        .filter(DiagramRevision.diagram_id.in_(diagram_ids))
        .order_by(DiagramRevision.id)
        .all()
        if diagram_ids else []
    )
    snapshot["entities"]["diagram_revision"] = [
        _serialize(row) for row in revisions
    ]
    return snapshot
@router.post("/{project_id}/baselines")
def create_baseline(
    project_id: int,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _owned_project(project_id, db, current_user)
    try:
        latest_version = (
            db.query(ProjectBaseline.version)
            .filter(ProjectBaseline.project_id == project_id)
            .order_by(ProjectBaseline.version.desc())
            .first()
        )
        version = (latest_version[0] if latest_version else 0) + 1
        snapshot = _project_snapshot(db, project_id)
        baseline = ProjectBaseline(
            project_id=project_id,
            version=version,
            name=str(payload.get("name") or f"Baseline {version}"),
            status="draft",
            snapshot=snapshot,
            open_issues=payload.get("open_issues") or [],
            created_by=current_user.id,
        )
        db.add(baseline)
        db.commit()
        db.refresh(baseline)
        return {
            "id": baseline.id,
            "project_id": baseline.project_id,
            "version": baseline.version,
            "name": baseline.name,
            "status": baseline.status,
            "created_at": baseline.created_at,
            "snapshot_entity_types": list(snapshot["entities"].keys()),
        }
    except (SQLAlchemyError, TypeError, ValueError):
        db.rollback()
        logger.exception("Could not create project baseline")
        raise HTTPException(status_code=500, detail="Không thể tạo baseline.")
@router.get("/{project_id}/baselines")
def list_baselines(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _owned_project(project_id, db, current_user)
    rows = (
        db.query(ProjectBaseline)
        .filter(ProjectBaseline.project_id == project_id)
        .order_by(ProjectBaseline.version.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "version": row.version,
            "name": row.name,
            "status": row.status,
            "created_at": row.created_at,
            "approved_at": row.approved_at,
            "open_issues": row.open_issues,
        }
        for row in rows
    ]
@router.get("/{project_id}/baselines/{baseline_id}")
def get_baseline(
    project_id: int,
    baseline_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _owned_project(project_id, db, current_user)
    row = (
        db.query(ProjectBaseline)
        .filter(
            ProjectBaseline.id == baseline_id,
            ProjectBaseline.project_id == project_id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy baseline.")
    return {
        "id": row.id,
        "project_id": row.project_id,
        "version": row.version,
        "name": row.name,
        "status": row.status,
        "snapshot": row.snapshot,
        "open_issues": row.open_issues,
        "created_at": row.created_at,
        "approved_at": row.approved_at,
    }

def _partition_baseline_issues(issues: list[Any]) -> tuple[list[Any], list[Any]]:
    """CON-007: chỉ coi sai lệch là đã chấp nhận khi có trạng thái và lý do rõ ràng."""
    unresolved = []
    accepted = []
    for issue in issues:
        if not isinstance(issue, dict):
            unresolved.append(issue)
            continue
        status = str(issue.get("status") or "").strip().lower()
        reason = str(
            issue.get("acceptance_reason")
            or issue.get("reason")
            or ""
        ).strip()
        if status in {"accepted", "waived"} and reason:
            accepted.append(issue)
        else:
            unresolved.append(issue)
    return unresolved, accepted


def _check_use_case_scenarios_snapshot(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    """CON-002: mỗi Use Case cần có luồng kịch bản và đặc tả FR để xuất vào SRS."""
    entities = snapshot.get("entities", {})
    if not isinstance(entities, dict):
        return [{"type": "invalid_snapshot", "message": "Snapshot thiếu entities hợp lệ."}]

    use_cases = entities.get("use_case", [])
    specifications = entities.get("specification", [])
    if not isinstance(use_cases, list) or not isinstance(specifications, list):
        return [{
            "type": "invalid_snapshot",
            "message": "Danh sách Use Case hoặc đặc tả không hợp lệ.",
        }]

    functional_spec_ids = {
        item.get("id")
        for item in specifications
        if isinstance(item, dict) and item.get("type") == "functional"
    }
    issues = []
    for use_case in use_cases:
        if not isinstance(use_case, dict):
            issues.append({
                "type": "invalid_use_case",
                "use_case_id": None,
            })
            continue
        use_case_id = use_case.get("id")
        scenario = str(use_case.get("main_flow") or "").strip()
        specification_id = use_case.get("specification_id")
        if not scenario:
            issues.append({
                "type": "missing_use_case_scenario",
                "use_case_id": use_case_id,
            })
        if specification_id not in functional_spec_ids:
            issues.append({
                "type": "missing_srs_section",
                "use_case_id": use_case_id,
                "specification_id": specification_id,
            })
    return issues


def _check_requirement_coverage_snapshot(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    """CON-001: mỗi yêu cầu phải đi tới Use Case hoặc nêu rõ ngoại lệ."""
    entities = snapshot.get("entities", {})
    if not isinstance(entities, dict):
        return [{"type": "invalid_snapshot", "message": "Snapshot thiếu entities hợp lệ."}]

    requirements = entities.get("raw_requirement", [])
    stories = entities.get("user_story", [])
    specifications = entities.get("specification", [])
    use_cases = entities.get("use_case", [])
    trace_links = entities.get("trace_link", [])
    if not all(isinstance(rows, list) for rows in (
        requirements, stories, specifications, use_cases, trace_links
    )):
        return [{
            "type": "invalid_snapshot",
            "message": "Dữ liệu yêu cầu, User Story, đặc tả, Use Case hoặc trace link không hợp lệ.",
        }]

    story_ids_by_requirement = {}
    for story in stories:
        if isinstance(story, dict):
            story_ids_by_requirement.setdefault(story.get("requirement_id"), set()).add(story.get("id"))

    spec_ids_by_story = {}
    for spec in specifications:
        if isinstance(spec, dict) and spec.get("user_story_id") is not None:
            spec_ids_by_story.setdefault(spec.get("user_story_id"), set()).add(spec.get("id"))

    covered_spec_ids = {
        use_case.get("specification_id")
        for use_case in use_cases
        if isinstance(use_case, dict) and use_case.get("specification_id") is not None
    }
    explicitly_linked_requirement_ids = set()
    for link in trace_links:
        if not isinstance(link, dict):
            continue
        source_type = str(link.get("source_type") or "").strip().lower()
        target_type = str(link.get("target_type") or "").strip().lower()
        source_id = link.get("source_id")
        target_id = link.get("target_id")
        if source_type in {"requirement", "raw_requirement"} and target_type == "use_case":
            explicitly_linked_requirement_ids.add(source_id)
        elif target_type in {"requirement", "raw_requirement"} and source_type == "use_case":
            explicitly_linked_requirement_ids.add(target_id)

    issues = []
    for requirement in requirements:
        if not isinstance(requirement, dict):
            issues.append({
                "type": "invalid_requirement",
                "requirement_id": None,
            })
            continue
        requirement_id = requirement.get("id")
        story_ids = story_ids_by_requirement.get(requirement_id, set())
        linked_spec_ids = {
            spec_id
            for story_id in story_ids
            for spec_id in spec_ids_by_story.get(story_id, set())
        }
        has_use_case = bool(linked_spec_ids & covered_spec_ids)
        notes = str(requirement.get("technical_notes") or "").strip().casefold()
        documented_exception = notes.startswith(("ngoại lệ:", "ngoai le:", "exception:"))
        if (
            not has_use_case
            and requirement_id not in explicitly_linked_requirement_ids
            and not documented_exception
        ):
            issues.append({
                "type": "requirement_without_use_case",
                "requirement_id": requirement_id,
                "user_story_ids": sorted(story_ids),
                "specification_ids": sorted(linked_spec_ids),
            })
    return issues


def _check_acceptance_criteria_snapshot(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    """CON-008: mỗi User Story và đặc tả chức năng phải có tiêu chí chấp nhận."""
    entities = snapshot.get("entities", {})
    if not isinstance(entities, dict):
        return [{"type": "invalid_snapshot", "message": "Snapshot thiếu entities hợp lệ."}]

    stories = entities.get("user_story", [])
    specifications = entities.get("specification", [])
    if not isinstance(stories, list) or not isinstance(specifications, list):
        return [{
            "type": "invalid_snapshot",
            "message": "Danh sách User Story hoặc đặc tả không hợp lệ.",
        }]

    def has_content(value: Any) -> bool:
        if value is None:
            return False
        if isinstance(value, str):
            return bool(value.strip())
        if isinstance(value, (list, dict)):
            return bool(value)
        return bool(str(value).strip())

    story_by_id = {
        item.get("id"): item
        for item in stories
        if isinstance(item, dict) and item.get("id") is not None
    }
    issues = []
    for story_id, story in story_by_id.items():
        if not has_content(story.get("acceptance_criteria")):
            issues.append({
                "type": "missing_acceptance_criteria",
                "entity_type": "user_story",
                "entity_id": story_id,
            })

    for spec in specifications:
        if not isinstance(spec, dict) or spec.get("type") != "functional":
            continue
        story = story_by_id.get(spec.get("user_story_id"), {})
        if has_content(story.get("acceptance_criteria")):
            continue

        content = spec.get("content")
        parsed_content = content
        if isinstance(content, str):
            try:
                parsed_content = json.loads(content)
            except (json.JSONDecodeError, TypeError):
                parsed_content = {}
        criteria = (
            parsed_content.get("acceptance_criteria")
            if isinstance(parsed_content, dict)
            else None
        )
        if not has_content(criteria):
            issues.append({
                "type": "missing_acceptance_criteria",
                "entity_type": "functional_specification",
                "entity_id": spec.get("id"),
                "user_story_id": spec.get("user_story_id"),
            })
    return issues


def _check_trace_links_snapshot(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    """Phát hiện trace link mồ côi trong baseline trước khi chốt chính thức."""
    entities = snapshot.get("entities", {})
    if not isinstance(entities, dict):
        return [{"type": "invalid_snapshot", "message": "Snapshot thiếu entities hợp lệ."}]

    type_aliases = {
        "requirement": "raw_requirement",
        "raw_requirement": "raw_requirement",
        "user_story": "user_story",
        "specification": "specification",
        "use_case": "use_case",
        "actor": "actor",
        "class": "class_entity",
        "class_entity": "class_entity",
        "diagram": "diagram",
        "glossary_term": "glossary_term",
        "srs_document": "srs_document",
    }
    ids_by_type = {
        entity_type: {
            item.get("id")
            for item in rows
            if isinstance(item, dict) and item.get("id") is not None
        }
        for entity_type, rows in entities.items()
        if isinstance(rows, list)
    }
    issues = []
    for link in entities.get("trace_link", []):
        if not isinstance(link, dict):
            issues.append({
                "type": "invalid_trace_link",
                "trace_link_id": None,
                "message": "Trace link trong snapshot không hợp lệ.",
            })
            continue

        link_id = link.get("id")
        for type_key, id_key in (
            ("source_type", "source_id"),
            ("target_type", "target_id"),
        ):
            raw_type = str(link.get(type_key) or "").strip().lower()
            entity_type = type_aliases.get(raw_type)
            entity_id = link.get(id_key)
            if entity_type is None:
                issues.append({
                    "type": "unsupported_trace_link_type",
                    "trace_link_id": link_id,
                    "endpoint": type_key.replace("_type", ""),
                    "entity_type": raw_type,
                })
                continue
            if entity_id not in ids_by_type.get(entity_type, set()):
                issues.append({
                    "type": "orphan_trace_link",
                    "trace_link_id": link_id,
                    "endpoint": type_key.replace("_type", ""),
                    "entity_type": raw_type,
                    "entity_id": entity_id,
                })
    return issues


def _check_sequence_methods_snapshot(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    """CON-003: lời gọi phương thức trong biểu đồ tuần tự phải có trong mô hình lớp."""
    entities = snapshot.get("entities", {})
    if not isinstance(entities, dict):
        return [{"type": "invalid_snapshot", "message": "Snapshot thiếu entities hợp lệ."}]
    diagrams = entities.get("diagram", [])
    classes = entities.get("class_entity", [])
    if not isinstance(diagrams, list) or not isinstance(classes, list):
        return [{"type": "invalid_snapshot", "message": "Danh sách biểu đồ hoặc lớp không hợp lệ."}]

    def decode_members(value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        if isinstance(value, str):
            try:
                decoded = json.loads(value)
            except (json.JSONDecodeError, TypeError):
                decoded = None
            if isinstance(decoded, list):
                return [str(item).strip() for item in decoded if str(item).strip()]
            return [line.strip() for line in value.splitlines() if line.strip()]
        return []

    methods_by_class: dict[str, set[str]] = {}
    all_methods: set[str] = set()
    for item in classes:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        methods = set()
        for declaration in decode_members(item.get("methods")):
            match = re.search(r"([A-Za-z_][\w]*)\s*\(", declaration)
            if match:
                methods.add(match.group(1).casefold())
        methods_by_class[name.casefold()] = methods
        all_methods.update(methods)

    issues = []
    for diagram in diagrams:
        if not isinstance(diagram, dict) or str(diagram.get("type") or "").casefold() != "sequence":
            continue
        source = diagram.get("source_code")
        if not isinstance(source, str) or not source.strip():
            continue
        aliases: dict[str, str] = {}
        for line in source.splitlines():
            declaration = re.match(
                r'\s*(?:participant|actor|boundary|control|entity|database|collections)\s+'
                r'(?:"([^"]+)"|([\w.]+))(?:\s+as\s+([\w.]+))?',
                line,
                re.IGNORECASE,
            )
            if declaration:
                display_name = (declaration.group(1) or declaration.group(2) or "").strip()
                alias = (declaration.group(3) or declaration.group(2) or display_name).strip()
                aliases[alias.casefold()] = display_name.casefold()

        for line_number, line in enumerate(source.splitlines(), start=1):
            if line.strip().startswith("'"):
                continue
            message = re.match(
                r"\s*([\w.]+)\s*(?:[-.]+>>?|<<?[-.]+|->|<-|\|o|o\|)\s*"
                r"([\w.]+)\s*:\s*(.+?)\s*$",
                line,
            )
            if not message:
                continue
            sender, receiver, label = message.groups()
            call = re.search(r"\b([A-Za-z_][\w]*)\s*\(", label)
            if not call:
                continue
            method_name = call.group(1).casefold()
            receiver_name = aliases.get(receiver.casefold(), receiver.casefold())
            exists = (
                method_name in methods_by_class[receiver_name]
                if receiver_name in methods_by_class
                else method_name in all_methods
            )
            if not exists:
                issues.append({
                    "type": "sequence_method_mismatch",
                    "diagram_id": diagram.get("id"),
                    "line": line_number,
                    "sender": aliases.get(sender.casefold(), sender.casefold()),
                    "receiver": receiver_name,
                    "method": method_name,
                })
    return issues


def _check_actor_glossary_snapshot(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    """CON-004: Actor dùng thuật ngữ chuẩn khi glossary đã khai báo bí danh."""
    entities = snapshot.get("entities", {})
    if not isinstance(entities, dict):
        return [{"type": "invalid_snapshot", "message": "Snapshot thiếu entities hợp lệ."}]
    actors = entities.get("actor", [])
    glossary = entities.get("glossary_term", [])
    diagrams = entities.get("diagram", [])
    if not all(isinstance(rows, list) for rows in (actors, glossary, diagrams)):
        return [{"type": "invalid_snapshot", "message": "Danh sách Actor, glossary hoặc diagram không hợp lệ."}]

    alias_to_canonical: dict[str, str] = {}
    for term in glossary:
        if not isinstance(term, dict):
            continue
        canonical = str(term.get("canonical_term") or term.get("term") or "").strip()
        if not canonical:
            continue
        aliases = term.get("aliases") or []
        if isinstance(aliases, str):
            try:
                aliases = json.loads(aliases)
            except (json.JSONDecodeError, TypeError):
                aliases = [aliases]
        if not isinstance(aliases, list):
            continue
        for alias in aliases:
            alias = str(alias).strip()
            if alias and alias.casefold() != canonical.casefold():
                alias_to_canonical[alias.casefold()] = canonical

    issues = []
    seen: set[tuple[str, str]] = set()
    for actor in actors:
        if not isinstance(actor, dict):
            continue
        name = str(actor.get("name") or "").strip()
        canonical = alias_to_canonical.get(name.casefold())
        if canonical and canonical.casefold() != name.casefold():
            seen.add((name.casefold(), canonical.casefold()))
            issues.append({
                "type": "actor_glossary_alias_mismatch",
                "actor_id": actor.get("id"),
                "actor_name": name,
                "canonical_term": canonical,
            })
    for diagram in diagrams:
        if not isinstance(diagram, dict) or str(diagram.get("type") or "").casefold() != "use_case":
            continue
        source = diagram.get("source_code")
        if not isinstance(source, str):
            continue
        try:
            parsed = parse_plantuml(source)
        except Exception:
            continue
        for parsed_actor in parsed.get("actors", []):
            name = str(parsed_actor.get("name") or "").strip()
            canonical = alias_to_canonical.get(name.casefold())
            key = (name.casefold(), canonical.casefold()) if canonical else None
            if canonical and key not in seen:
                seen.add(key)
                issues.append({
                    "type": "actor_glossary_alias_mismatch",
                    "diagram_id": diagram.get("id"),
                    "actor_name": name,
                    "canonical_term": canonical,
                })
    return issues


def _check_use_case_diagram_snapshot(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    """CON-006: đối chiếu Actor/Use Case trên sơ đồ với mô hình nghiệp vụ đã lưu."""
    entities = snapshot.get("entities", {})
    if not isinstance(entities, dict):
        return [{"type": "invalid_snapshot", "message": "Snapshot thiếu entities hợp lệ."}]
    actors = entities.get("actor", [])
    use_cases = entities.get("use_case", [])
    diagrams = entities.get("diagram", [])
    if not all(isinstance(rows, list) for rows in (actors, use_cases, diagrams)):
        return [{"type": "invalid_snapshot", "message": "Danh sách Actor, Use Case hoặc diagram không hợp lệ."}]

    saved_actors = {
        str(item.get("name") or "").strip().casefold()
        for item in actors
        if isinstance(item, dict) and str(item.get("name") or "").strip()
    }
    saved_use_cases = {
        str(item.get("name") or "").strip().casefold()
        for item in use_cases
        if isinstance(item, dict) and str(item.get("name") or "").strip()
    }
    issues = []
    for diagram in diagrams:
        if not isinstance(diagram, dict) or str(diagram.get("type") or "").casefold() != "use_case":
            continue
        source = diagram.get("source_code")
        if not isinstance(source, str) or not source.strip():
            issues.append({"type": "empty_use_case_diagram", "diagram_id": diagram.get("id")})
            continue
        try:
            parsed = parse_plantuml(source)
        except Exception as exc:
            issues.append({
                "type": "unparseable_use_case_diagram",
                "diagram_id": diagram.get("id"),
                "message": str(exc),
            })
            continue
        diagram_actors = {
            str(item.get("name") or "").strip().casefold()
            for item in parsed.get("actors", [])
            if str(item.get("name") or "").strip()
        }
        diagram_use_cases = {
            str(item.get("name") or "").strip().casefold()
            for item in parsed.get("use_cases", [])
            if str(item.get("name") or "").strip()
        }
        if diagram_actors != saved_actors or diagram_use_cases != saved_use_cases:
            issues.append({
                "type": "use_case_diagram_mismatch",
                "diagram_id": diagram.get("id"),
                "missing_in_snapshot_actors": sorted(diagram_actors - saved_actors),
                "missing_in_diagram_actors": sorted(saved_actors - diagram_actors),
                "missing_in_snapshot_use_cases": sorted(diagram_use_cases - saved_use_cases),
                "missing_in_diagram_use_cases": sorted(saved_use_cases - diagram_use_cases),
            })
    return issues


def _check_class_diagram_snapshot(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    """Kiểm tra class diagram trong snapshot so với class và relation đã lưu."""
    entities = snapshot.get("entities", {})
    if not isinstance(entities, dict):
        return [{"type": "invalid_snapshot", "message": "Snapshot thiếu entities hợp lệ."}]

    classes = entities.get("class_entity", [])
    relations = entities.get("class_relation", [])
    diagrams = entities.get("diagram", [])

    if not all(isinstance(items, list) for items in (classes, relations, diagrams)):
        return [{"type": "invalid_snapshot", "message": "Dữ liệu class, relation hoặc diagram không hợp lệ."}]

    class_names = {
        str(item.get("name", "")).strip().casefold()
        for item in classes
        if isinstance(item, dict) and str(item.get("name", "")).strip()
    }
    class_ids = {
        item.get("id")
        for item in classes
        if isinstance(item, dict) and item.get("id") is not None
    }

    saved_relations = set()
    for item in relations:
        if not isinstance(item, dict):
            continue
        a_id = item.get("class_a_id")
        b_id = item.get("class_b_id")
        if a_id not in class_ids or b_id not in class_ids:
            return [{
                "type": "invalid_class_relation",
                "message": "Quan hệ lớp tham chiếu đến class không tồn tại trong snapshot.",
            }]
        names_by_id = {
            row.get("id"): str(row.get("name", "")).strip().casefold()
            for row in classes
            if isinstance(row, dict) and row.get("name")
        }
        a_name = names_by_id.get(a_id)
        b_name = names_by_id.get(b_id)
        if a_name and b_name:
            relation_type = str(item.get("relation_type") or "association").strip().casefold()
            endpoints = (a_name, b_name)
            if relation_type == "association":
                endpoints = tuple(sorted(endpoints))
            saved_relations.add((*endpoints, relation_type))

    issues = []
    class_diagrams = [
        item for item in diagrams
        if isinstance(item, dict) and item.get("type") == "class"
    ]

    if not class_diagrams:
        return issues

    # Nếu có nhiều biểu đồ lớp, kiểm tra phiên bản mới nhất.
    diagram = max(class_diagrams, key=lambda item: item.get("version") or 0)
    source_code = diagram.get("source_code")
    if not isinstance(source_code, str) or not source_code.strip():
        return [{"type": "empty_class_diagram", "diagram_id": diagram.get("id")}]

    try:
        parsed = parse_plantuml(source_code)
    except Exception as exc:
        return [{
            "type": "unparseable_class_diagram",
            "diagram_id": diagram.get("id"),
            "message": str(exc),
        }]

    def normalize_members(value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        if isinstance(value, str):
            try:
                decoded = json.loads(value)
            except (json.JSONDecodeError, TypeError):
                decoded = None
            if isinstance(decoded, list):
                return [str(item).strip() for item in decoded if str(item).strip()]
            return [line.strip() for line in value.splitlines() if line.strip()]
        return []

    saved_classes_by_name = {
        str(item.get("name", "")).strip().casefold(): item
        for item in classes
        if isinstance(item, dict) and str(item.get("name", "")).strip()
    }
    member_mismatches = []
    for parsed_class in parsed.get("classes", []):
        class_name = str(parsed_class.get("name", "")).strip()
        saved_class = saved_classes_by_name.get(class_name.casefold())
        if saved_class is None:
            continue
        for member_type in ("attributes", "methods"):
            diagram_members = normalize_members(parsed_class.get(member_type))
            saved_members = normalize_members(saved_class.get(member_type))
            if set(diagram_members) != set(saved_members):
                member_mismatches.append({
                    "class_name": class_name,
                    "member_type": member_type,
                    "missing_in_snapshot": sorted(set(diagram_members) - set(saved_members)),
                    "missing_in_diagram": sorted(set(saved_members) - set(diagram_members)),
                })
    if member_mismatches:
        issues.append({
            "type": "class_members_mismatch",
            "diagram_id": diagram.get("id"),
            "mismatches": member_mismatches,
        })

    parsed_classes = {
        str(item.get("name", "")).strip().casefold()
        for item in parsed.get("classes", [])
        if str(item.get("name", "")).strip()
    }
    if parsed_classes != class_names:
        issues.append({
            "type": "class_mismatch",
            "diagram_id": diagram.get("id"),
            "missing_in_snapshot": sorted(parsed_classes - class_names),
            "missing_in_diagram": sorted(class_names - parsed_classes),
        })

    parsed_relations = set()
    for item in parsed.get("relations", []):
        source = str(item.get("from", "")).strip().casefold()
        target = str(item.get("to", "")).strip().casefold()
        if source and target:
            relation_type = str(item.get("type") or "association").strip().casefold()
            endpoints = (source, target)
            if relation_type == "association":
                endpoints = tuple(sorted(endpoints))
            parsed_relations.add((*endpoints, relation_type))

    if parsed_relations != saved_relations:
        issues.append({
            "type": "class_relation_mismatch",
            "diagram_id": diagram.get("id"),
            "missing_in_snapshot": [
                {"from": a, "to": b, "type": relation_type}
                for a, b, relation_type in sorted(parsed_relations - saved_relations)
            ],
            "missing_in_diagram": [
                {"from": a, "to": b, "type": relation_type}
                for a, b, relation_type in sorted(saved_relations - parsed_relations)
            ],
        })

    return issues
@router.post("/{project_id}/baselines/{baseline_id}/approve")
def approve_baseline(
    project_id: int,
    baseline_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _owned_project(project_id, db, current_user)

    row = (
        db.query(ProjectBaseline)
        .filter(
            ProjectBaseline.id == baseline_id,
            ProjectBaseline.project_id == project_id,
        )
        .with_for_update()
        .first()
    )

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy baseline.",
        )

    if row.status != "draft":
        raise HTTPException(
            status_code=409,
            detail="Chỉ baseline ở trạng thái draft mới được duyệt.",
        )

    # Snapshot phải có cấu trúc hợp lệ.
    snapshot = row.snapshot
    if (
        not isinstance(snapshot, dict)
        or snapshot.get("project_id") != project_id
        or not isinstance(snapshot.get("entities"), dict)
    ):
        raise HTTPException(
            status_code=409,
            detail="Snapshot baseline không hợp lệ hoặc không thuộc project này.",
        )

    # Baseline là ảnh chụp bất biến: nếu dữ liệu dự án đã đổi sau khi tạo
    # snapshot, yêu cầu tạo baseline mới thay vì duyệt một bản đã lỗi thời.
    current_snapshot = _project_snapshot(db, project_id)
    if current_snapshot != snapshot:
        raise HTTPException(
            status_code=409,
            detail=(
                "Dữ liệu dự án đã thay đổi sau khi tạo baseline. "
                "Tạo baseline mới để bảo đảm snapshot phản ánh dữ liệu hiện tại."
            ),
        )

    # Cổng nghiệp vụ: không duyệt baseline nếu yêu cầu đầu vào chưa được xác nhận
    # hoặc chưa có User Story và đặc tả FR/NFR trong snapshot.
    entities = snapshot["entities"]
    requirements = entities.get("raw_requirement", [])
    stories = entities.get("user_story", [])
    specifications = entities.get("specification", [])
    if not isinstance(requirements, list) or not requirements:
        raise HTTPException(
            status_code=409,
            detail="Không thể duyệt baseline khi dự án chưa có yêu cầu đầu vào.",
        )
    unconfirmed = [
        item.get("id") if isinstance(item, dict) else None
        for item in requirements
        if not isinstance(item, dict) or item.get("status") != "confirmed"
    ]
    if unconfirmed:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Còn yêu cầu chưa được xác nhận; hãy quay lại Giai đoạn 1.",
                "requirement_ids": unconfirmed,
            },
        )
    if not isinstance(stories, list) or not stories:
        raise HTTPException(
            status_code=409,
            detail="Không thể duyệt baseline khi chưa có User Story.",
        )
    if not isinstance(specifications, list) or not specifications:
        raise HTTPException(
            status_code=409,
            detail="Không thể duyệt baseline khi chưa có đặc tả FR/NFR.",
        )

    # Trạng thái duyệt phải được xác minh từ cơ sở dữ liệu, không tin dữ liệu
    # do client gửi hoặc chỉ có trong snapshot baseline.
    specification_ids = [
        item.get("id")
        for item in specifications
        if isinstance(item, dict) and isinstance(item.get("id"), int)
    ]
    current_specifications = (
        db.query(Specification)
        .filter(Specification.id.in_(specification_ids))
        .all()
        if specification_ids else []
    )
    approval_rows = (
        db.query(SpecificationApproval)
        .filter(SpecificationApproval.specification_id.in_(specification_ids))
        .all()
        if specification_ids else []
    )
    approved_ids = {
        row.specification_id for row in approval_rows if row.status == "approved"
    }
    current_specification_ids = {row.id for row in current_specifications}
    expected_types = {"functional", "non_functional"}
    actual_types = {row.type for row in current_specifications}
    missing_approval_ids = sorted(current_specification_ids - approved_ids)
    missing_types = sorted(expected_types - actual_types)
    if missing_approval_ids or missing_types or current_specification_ids != set(specification_ids):
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Không thể duyệt baseline khi FR/NFR chưa được duyệt đầy đủ hoặc dữ liệu đặc tả đã thay đổi.",
                "specification_ids_chua_duyet": missing_approval_ids,
                "loai_dac_ta_con_thieu": missing_types,
            },
        )

    # Cần có mô hình UML tối thiểu trước khi chốt baseline chính thức.
    # CON-003: kiểm tra lời gọi phương thức trong biểu đồ tuần tự.
    sequence_method_issues = _check_sequence_methods_snapshot(snapshot)
    if sequence_method_issues:
        raise HTTPException(status_code=409, detail={
            "message": "Không thể duyệt baseline vì biểu đồ tuần tự gọi phương thức chưa có trong mô hình lớp.",
            "sequence_method_issues": sequence_method_issues,
        })

    # CON-004: dùng thuật ngữ Actor chuẩn khi glossary đã khai báo bí danh.
    actor_glossary_issues = _check_actor_glossary_snapshot(snapshot)
    if actor_glossary_issues:
        raise HTTPException(status_code=409, detail={
            "message": "Không thể duyệt baseline vì tên Actor chưa thống nhất với thuật ngữ chuẩn.",
            "actor_glossary_issues": actor_glossary_issues,
        })

    # CON-002: Use Case phải có kịch bản chính và đặc tả chức năng được đưa vào SRS.
    use_case_scenario_issues = _check_use_case_scenarios_snapshot(snapshot)
    if use_case_scenario_issues:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Không thể duyệt baseline vì Use Case thiếu kịch bản hoặc đặc tả SRS tương ứng.",
                "use_case_scenario_issues": use_case_scenario_issues,
            },
        )

    # CON-001: yêu cầu phải được truy vết tới Use Case hoặc có ngoại lệ ghi rõ.
    requirement_coverage_issues = _check_requirement_coverage_snapshot(snapshot)
    if requirement_coverage_issues:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Không thể duyệt baseline vì có yêu cầu chưa được truy vết tới Use Case.",
                "requirement_coverage_issues": requirement_coverage_issues,
            },
        )

    # CON-008: không chốt baseline khi User Story/FR thiếu tiêu chí chấp nhận.
    acceptance_criteria_issues = _check_acceptance_criteria_snapshot(snapshot)
    if acceptance_criteria_issues:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Không thể duyệt baseline khi còn User Story/FR thiếu tiêu chí chấp nhận.",
                "acceptance_criteria_issues": acceptance_criteria_issues,
            },
        )

    actors = entities.get("actor", [])
    use_cases = entities.get("use_case", [])
    diagrams = entities.get("diagram", [])
    if not isinstance(actors, list) or not actors:
        raise HTTPException(
            status_code=409,
            detail="Không thể duyệt baseline khi chưa có Actor.",
        )
    if not isinstance(use_cases, list) or not use_cases:
        raise HTTPException(
            status_code=409,
            detail="Không thể duyệt baseline khi chưa có Use Case.",
        )
    if not isinstance(diagrams, list):
        raise HTTPException(
            status_code=409,
            detail="Danh sách biểu đồ trong snapshot không hợp lệ.",
        )
    diagram_types = {
        item.get("type")
        for item in diagrams
        if isinstance(item, dict)
    }
    missing_diagrams = [
        diagram_type
        for diagram_type in ("use_case", "class")
        if diagram_type not in diagram_types
    ]
    if missing_diagrams:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Chưa đủ biểu đồ UML để duyệt baseline.",
                "missing_diagram_types": missing_diagrams,
            },
        )

    # Không duyệt khi còn vấn đề chưa được xử lý.
    open_issues = row.open_issues
    if open_issues is None:
        open_issues = []

    if not isinstance(open_issues, list):
        raise HTTPException(
            status_code=409,
            detail="Danh sách open_issues của baseline không hợp lệ.",
        )

    unresolved_issues, accepted_issues = _partition_baseline_issues(open_issues)
    if unresolved_issues:
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    "Baseline còn vấn đề chưa xử lý; "
                    "sai lệch được chấp nhận phải có trạng thái accepted/waived và lý do."
                ),
                "open_issues": unresolved_issues,
                "accepted_issues": accepted_issues,
            },
        )

    use_case_diagram_issues = _check_use_case_diagram_snapshot(snapshot)
    if use_case_diagram_issues:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Không thể duyệt baseline vì sơ đồ Use Case chưa đồng bộ với mô hình đã lưu.",
                "use_case_diagram_issues": use_case_diagram_issues,
            },
        )

    # Luôn kiểm tra snapshot UML trước khi duyệt, kể cả khi không có open issues.
    # CON-005: trace link phải trỏ đến phần tử có thật trong cùng snapshot.
    trace_link_issues = _check_trace_links_snapshot(snapshot)
    if trace_link_issues:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Không thể duyệt baseline vì có trace link không hợp lệ.",
                "trace_link_issues": trace_link_issues,
            },
        )

    uml_issues = _check_class_diagram_snapshot(snapshot)
    if uml_issues:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Không thể duyệt baseline vì UML chưa nhất quán.",
                "uml_issues": uml_issues,
            },
        )
    row.status = "approved"
    row.approved_at = datetime.now(timezone.utc)

    try:
        db.commit()
        db.refresh(row)
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Could not approve project baseline")
        raise HTTPException(
            status_code=500,
            detail="Không thể duyệt baseline.",
        )

    return {
        "id": row.id,
        "version": row.version,
        "status": row.status,
        "approved_at": row.approved_at,
    }

@router.post("/{project_id}/trace-links")
def create_trace_link(
    project_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _owned_project(project_id, db, current_user)
    required = ("source_type", "source_id", "target_type", "target_id")
    if any(key not in payload for key in required):
        raise HTTPException(
            status_code=422,
            detail="Cần source_type, source_id, target_type và target_id.",
        )
    source_type = str(payload["source_type"]).lower()
    target_type = str(payload["target_type"]).lower()
    try:
        source_id = int(payload["source_id"])
        target_id = int(payload["target_id"])
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="ID phần tử phải là số nguyên.")
    if source_type == target_type and source_id == target_id:
        raise HTTPException(status_code=422, detail="Không thể tự liên kết phần tử.")
    # Each type maps to a table and a project-scope check.
    model_map = {
        "requirement": RawRequirement,
        "raw_requirement": RawRequirement,
        "user_story": UserStory,
        "specification": Specification,
        "use_case": UseCase,
        "actor": Actor,
        "class": ClassEntity,
        "class_entity": ClassEntity,
        "diagram": Diagram,
        "glossary_term": GlossaryTerm,
        "srs_document": SrsDocument,
    }
    def element_exists(element_type: str, element_id: int) -> bool:
        model = model_map.get(element_type)
        if model is None:
            raise HTTPException(
                status_code=422,
                detail=f"Loại phần tử chưa được hỗ trợ: {element_type}",
            )
        query = db.query(model).filter(model.id == element_id)
        # Một số đặc tả thuộc User Story có project_id = NULL; xác định
        # phạm vi dự án qua RawRequirement trong trường hợp đó.
        if model is Specification:
            query = query.outerjoin(
                UserStory,
                Specification.user_story_id == UserStory.id,
            ).outerjoin(
                RawRequirement,
                UserStory.requirement_id == RawRequirement.id,
            ).filter(
                (Specification.project_id == project_id)
                | (RawRequirement.project_id == project_id)
            )
        elif model is UserStory:
            query = query.join(
                RawRequirement,
                UserStory.requirement_id == RawRequirement.id,
            ).filter(RawRequirement.project_id == project_id)
        elif model is UseCase:
            query = query.join(
                Specification,
                UseCase.specification_id == Specification.id,
            ).outerjoin(
                UserStory,
                Specification.user_story_id == UserStory.id,
            ).outerjoin(
                RawRequirement,
                UserStory.requirement_id == RawRequirement.id,
            ).filter(
                (Specification.project_id == project_id)
                | (RawRequirement.project_id == project_id)
            )
        elif hasattr(model, "project_id"):
            query = query.filter(model.project_id == project_id)
        return query.first() is not None
    if not element_exists(source_type, source_id):
        raise HTTPException(
            status_code=422,
            detail="Phần tử nguồn không tồn tại trong project này.",
        )
    if not element_exists(target_type, target_id):
        raise HTTPException(
            status_code=422,
            detail="Phần tử đích không tồn tại trong project này.",
        )
    link = TraceLink(
        project_id=project_id,
        source_type=source_type,
        source_id=source_id,
        target_type=target_type,
        target_id=target_id,
        relation_type=str(payload.get("relation_type") or "traces_to"),
        rationale=str(payload.get("rationale") or ""),
        validation_status="valid",
        validation_message="Hai phần tử đã được xác nhận tồn tại trong project.",
    )
    try:
        db.add(link)
        db.commit()
        db.refresh(link)
        return _serialize(link)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Trace link này đã tồn tại hoặc vi phạm ràng buộc dữ liệu.",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Could not create trace link")
        raise HTTPException(status_code=500, detail="Không thể tạo trace link.")
@router.get("/{project_id}/trace-links")
def list_trace_links(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _owned_project(project_id, db, current_user)
    rows = (
        db.query(TraceLink)
        .filter(TraceLink.project_id == project_id)
        .order_by(TraceLink.id)
        .all()
    )
    return [_serialize(row) for row in rows]
@router.delete("/{project_id}/trace-links/{link_id}")
def delete_trace_link(
    project_id: int,
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _owned_project(project_id, db, current_user)
    row = (
        db.query(TraceLink)
        .filter(
            TraceLink.id == link_id,
            TraceLink.project_id == project_id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy trace link.")
    db.delete(row)
    db.commit()
    return {"deleted": True, "id": link_id}
