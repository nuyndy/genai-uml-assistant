"""Shared immutable revision snapshots for project entities."""
from __future__ import annotations

from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.models import EntityRevision


def record_entity_revision(
    db: Session,
    entity: Any,
    *,
    project_id: int,
    entity_type: str,
    user_id: int | None = None,
    change_type: str = "update",
    change_note: str = "",
) -> EntityRevision | None:
    """Append a revision only when the persisted entity content changed."""
    content = jsonable_encoder(
        {
            column.key: getattr(entity, column.key)
            for column in entity.__table__.columns
        }
    )
    latest = (
        db.query(EntityRevision)
        .filter(
            EntityRevision.project_id == project_id,
            EntityRevision.entity_type == entity_type,
            EntityRevision.entity_id == entity.id,
        )
        .order_by(EntityRevision.version.desc())
        .first()
    )
    if latest is not None and latest.content == content:
        return None

    version = (
        db.query(func.max(EntityRevision.version))
        .filter(
            EntityRevision.project_id == project_id,
            EntityRevision.entity_type == entity_type,
            EntityRevision.entity_id == entity.id,
        )
        .scalar()
        or 0
    ) + 1
    revision = EntityRevision(
        project_id=project_id,
        entity_type=entity_type,
        entity_id=entity.id,
        version=version,
        content=content,
        change_type=change_type,
        change_note=change_note,
        created_by=user_id,
    )
    db.add(revision)
    return revision
