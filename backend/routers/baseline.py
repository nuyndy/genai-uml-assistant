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
    if project.user_id is not None and project.user_id != user.id:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập project.")
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

@router.post("/{project_id}/baselines/{baseline_id}/approve")

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
            endpoints = tuple(sorted((a_name, b_name)))
            relation_type = str(item.get("relation_type") or "association").strip().casefold()
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
            parsed_relations.add((
                *sorted((source, target)),
                str(item.get("type") or "association").strip().casefold(),
            ))

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

    # Không duyệt khi còn vấn đề chưa được xử lý.
    open_issues = row.open_issues
    if open_issues is None:
        open_issues = []

    if not isinstance(open_issues, list):
        raise HTTPException(
            status_code=409,
            detail="Danh sách open_issues của baseline không hợp lệ.",
        )

    if open_issues:
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    "Baseline còn vấn đề chưa xử lý; "
                    "hãy xử lý hoặc ghi nhận việc chấp nhận sai lệch trước khi duyệt."
                ),
                "open_issues": open_issues,
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
        if hasattr(model, "project_id"):
            query = query.filter(model.project_id == project_id)
        elif model is UserStory:
            query = query.join(
                RawRequirement,
                UserStory.requirement_id == RawRequirement.id,
            ).filter(RawRequirement.project_id == project_id)
        elif model is UseCase:
            query = query.join(
                Specification,
                UseCase.specification_id == Specification.id,
            ).filter(Specification.project_id == project_id)
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
