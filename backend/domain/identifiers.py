"""Stable public identifiers for domain entities.

Database integer primary keys remain internal persistence identifiers. Public
keys add an entity namespace and zero padding so IDs remain unambiguous across
different entity tables and stable across edits.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EntityKey:
    entity_type: str
    entity_id: int
    value: str


_PREFIXES = {
    "project": "PRJ",
    "raw_requirement": "REQ",
    "requirement": "REQ",
    "user_story": "US",
    "specification": "NFR",  # overridden to FR for functional specs
    "actor": "ACT",
    "use_case": "UC",
    "class_entity": "CLS",
    "class": "CLS",
    "diagram": "DGM",
    "diagram_revision": "DREV",
    "srs_document": "SRS",
    "glossary_term": "TERM",
    "trace_link": "TRACE",
    "project_baseline": "BASE",
    "entity_revision": "REV",
    "uc_actor_relation": "UCR",
    "class_relation": "CLR",
}


def entity_key(entity_type: str, entity_id: int, *, subtype: str | None = None) -> str:
    """Return a stable, namespaced key for a persisted entity."""
    normalized_type = entity_type.strip().lower()
    if not normalized_type:
        raise ValueError("entity_type must not be empty")
    if isinstance(entity_id, bool) or not isinstance(entity_id, int) or entity_id <= 0:
        raise ValueError("entity_id must be a positive integer")

    prefix = _PREFIXES.get(normalized_type)
    if prefix is None:
        raise ValueError(f"Unsupported entity type: {entity_type}")

    if normalized_type == "specification":
        prefix = "NFR" if subtype in {"non_functional", "nfr"} else "FR"

    return f"{prefix}-{entity_id:06d}"


def parse_entity_key(value: str) -> EntityKey:
    """Parse a public key. The returned entity type is the canonical type."""
    if not isinstance(value, str):
        raise ValueError("Entity key must be a string")
    parts = value.strip().upper().split("-", maxsplit=1)
    if len(parts) != 2 or not parts[1].isdigit():
        raise ValueError(f"Invalid entity key: {value}")

    prefix, raw_id = parts
    reverse_prefixes = {
        prefix: entity_type
        for entity_type, prefix in _PREFIXES.items()
        if entity_type not in {"requirement", "class"}
    }
    reverse_prefixes.update({"FR": "specification", "NFR": "specification"})
    entity_type = reverse_prefixes.get(prefix)
    entity_id = int(raw_id)
    if entity_type is None or entity_id <= 0:
        raise ValueError(f"Unsupported entity key: {value}")
    return EntityKey(entity_type=entity_type, entity_id=entity_id, value=f"{prefix}-{entity_id:06d}")
