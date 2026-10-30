"""Shared helpers for immutable snapshots of project business entities."""
from __future__ import annotations

from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.models import EntityRevision


def record_entity_revision(
    db: Session,
    *,
    project_id: int,
    entity_type: str,
    entity_id: int,
    content: dict[str, Any],
    change_type: str = "update",
    change_note: str = "",
    created_by: int | None = None,
) -> EntityRevision:
    """Append the next immutable revision for one project entity."""
    latest_version = (
        db.query(func.max(EntityRevision.version))
        .filter(
            EntityRevision.project_id == project_id,
            EntityRevision.entity_type == entity_type,
            EntityRevision.entity_id == entity_id,
        )
        .scalar()
        or 0
    )
    revision = EntityRevision(
        project_id=project_id,
        entity_type=entity_type,
        entity_id=entity_id,
        version=latest_version + 1,
        content=jsonable_encoder(content),
        change_type=change_type,
        change_note=change_note,
        created_by=created_by,
    )
    db.add(revision)
    return revision
