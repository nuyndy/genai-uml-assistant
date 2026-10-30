import pytest

from domain.identifiers import entity_key, parse_entity_key


@pytest.mark.parametrize(
    ("entity_type", "entity_id", "expected"),
    [
        ("raw_requirement", 7, "REQ-000007"),
        ("user_story", 7, "US-000007"),
        ("actor", 7, "ACT-000007"),
        ("use_case", 7, "UC-000007"),
        ("class_entity", 7, "CLS-000007"),
        ("specification", 7, "FR-000007"),
        ("specification", 7, "NFR-000007"),
    ],
)
def test_entity_key_is_namespaced_and_stable(entity_type, entity_id, expected):
    subtype = "non_functional" if expected.startswith("NFR") else None
    assert entity_key(entity_type, entity_id, subtype=subtype) == expected


def test_parse_entity_key_returns_canonical_entity_type():
    parsed = parse_entity_key("FR-000042")
    assert parsed.entity_type == "specification"
    assert parsed.entity_id == 42
    assert parsed.value == "FR-000042"


@pytest.mark.parametrize(
    ("entity_type", "entity_id"),
    [("", 1), ("unknown", 1), ("actor", 0), ("actor", -1), ("actor", True)],
)
def test_entity_key_rejects_invalid_identity(entity_type, entity_id):
    with pytest.raises(ValueError):
        entity_key(entity_type, entity_id)


@pytest.mark.parametrize("value", ["", "ACT", "ACT-0", "UNKNOWN-000001", "UC-x"])
def test_parse_entity_key_rejects_invalid_key(value):
    with pytest.raises(ValueError):
        parse_entity_key(value)
