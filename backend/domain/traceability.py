"""Canonical entity types accepted by cross-domain trace links.

Keep this registry independent from SQLAlchemy models so API validation,
snapshot validation and future import/export tooling share one vocabulary.
"""

TRACE_ENTITY_TYPE_ALIASES = {
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


def canonical_trace_entity_type(value: str) -> str:
    """Normalize a supported trace endpoint type or raise ValueError."""
    normalized = str(value or "").strip().lower()
    canonical = TRACE_ENTITY_TYPE_ALIASES.get(normalized)
    if canonical is None:
        raise ValueError(f"Unsupported trace entity type: {normalized}")
    return canonical
