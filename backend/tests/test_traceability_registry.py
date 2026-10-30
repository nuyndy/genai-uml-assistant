import pytest

from domain.traceability import (
    TRACE_ENTITY_TYPE_ALIASES,
    canonical_trace_entity_type,
)


@pytest.mark.parametrize(
    ("alias", "canonical"),
    sorted(TRACE_ENTITY_TYPE_ALIASES.items()),
)
def test_trace_entity_aliases_resolve_to_canonical_type(alias, canonical):
    assert canonical_trace_entity_type(alias) == canonical


@pytest.mark.parametrize("value", ["", "unknown", "class_diagram", "project"])
def test_unknown_trace_entity_type_is_rejected(value):
    with pytest.raises(ValueError):
        canonical_trace_entity_type(value)
