from routers.baseline import _check_class_diagram_snapshot
from services.plantuml_parser import parse_plantuml


def _class_diagram(relation: str) -> str:
    return f"""@startuml
class "DonHang" as C1 {{
  +xacNhan()
}}
class "SanPham" as C2 {{
  +kiemTraTonKho()
}}
{relation}
@enduml"""


def _snapshot(relation: str) -> dict:
    return {
        "project_id": 1,
        "entities": {
            "class_entity": [
                {"id": 10, "name": "DonHang"},
                {"id": 20, "name": "SanPham"},
            ],
            "class_relation": [
                {
                    "id": 30,
                    "class_a_id": 10,
                    "class_b_id": 20,
                    "relation_type": "inheritance",
                }
            ],
            "diagram": [
                {
                    "id": 40,
                    "type": "class",
                    "version": 1,
                    "source_code": _class_diagram(relation),
                }
            ],
        },
    }


def test_parser_resolves_class_aliases_in_relations():
    parsed = parse_plantuml(_class_diagram("C1 --|> C2 : inheritance"))

    assert parsed["relations"] == [
        {
            "from": "DonHang",
            "to": "SanPham",
            "type": "inheritance",
            "label": "inheritance",
        }
    ]


def test_baseline_consistency_detects_reversed_inheritance_relation():
    issues = _check_class_diagram_snapshot(
        _snapshot("C2 --|> C1 : inheritance")
    )

    assert any(issue["type"] == "class_relation_mismatch" for issue in issues)


def test_baseline_consistency_accepts_matching_inheritance_direction():
    issues = _check_class_diagram_snapshot(
        _snapshot("C1 --|> C2 : inheritance")
    )

    assert not any(issue["type"] == "class_relation_mismatch" for issue in issues)
