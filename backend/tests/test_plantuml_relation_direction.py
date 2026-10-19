from routers.baseline import _check_acceptance_criteria_snapshot, _check_class_diagram_snapshot, _check_requirement_coverage_snapshot, _check_trace_links_snapshot
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



def test_baseline_consistency_detects_orphan_trace_link():
    snapshot = {
        "project_id": 1,
        "entities": {
            "raw_requirement": [{"id": 1}],
            "trace_link": [{
                "id": 99,
                "source_type": "requirement",
                "source_id": 1,
                "target_type": "use_case",
                "target_id": 404,
            }],
        },
    }

    issues = _check_trace_links_snapshot(snapshot)

    assert issues == [{
        "type": "orphan_trace_link",
        "trace_link_id": 99,
        "endpoint": "target",
        "entity_type": "use_case",
        "entity_id": 404,
    }]


def test_baseline_consistency_accepts_trace_link_type_aliases():
    snapshot = {
        "project_id": 1,
        "entities": {
            "raw_requirement": [{"id": 1}],
            "class_entity": [{"id": 2}],
            "trace_link": [{
                "id": 3,
                "source_type": "requirement",
                "source_id": 1,
                "target_type": "class",
                "target_id": 2,
            }],
        },
    }

    assert _check_trace_links_snapshot(snapshot) == []



def test_baseline_consistency_detects_missing_user_story_acceptance_criteria():
    snapshot = {
        "project_id": 1,
        "entities": {
            "user_story": [{"id": 10, "acceptance_criteria": ""}],
            "specification": [{
                "id": 20,
                "type": "functional",
                "user_story_id": 10,
                "content": "Đặc tả chức năng",
            }],
        },
    }

    issues = _check_acceptance_criteria_snapshot(snapshot)

    assert [issue["entity_type"] for issue in issues] == [
        "user_story",
        "functional_specification",
    ]


def test_baseline_consistency_accepts_story_acceptance_criteria():
    snapshot = {
        "project_id": 1,
        "entities": {
            "user_story": [{
                "id": 10,
                "acceptance_criteria": "Khi đặt hàng thành công, hiển thị mã đơn.",
            }],
            "specification": [{
                "id": 20,
                "type": "functional",
                "user_story_id": 10,
                "content": "Đặc tả chức năng",
            }],
        },
    }

    assert _check_acceptance_criteria_snapshot(snapshot) == []



def test_baseline_consistency_detects_requirement_without_use_case_or_exception():
    snapshot = {
        "project_id": 1,
        "entities": {
            "raw_requirement": [{"id": 1, "technical_notes": ""}],
            "user_story": [{"id": 2, "requirement_id": 1}],
            "specification": [{"id": 3, "user_story_id": 2, "type": "functional"}],
            "use_case": [],
            "trace_link": [],
        },
    }

    issues = _check_requirement_coverage_snapshot(snapshot)

    assert issues == [{
        "type": "requirement_without_use_case",
        "requirement_id": 1,
        "user_story_ids": [2],
        "specification_ids": [3],
    }]


def test_baseline_consistency_accepts_requirement_covered_by_use_case():
    snapshot = {
        "project_id": 1,
        "entities": {
            "raw_requirement": [{"id": 1, "technical_notes": ""}],
            "user_story": [{"id": 2, "requirement_id": 1}],
            "specification": [{"id": 3, "user_story_id": 2, "type": "functional"}],
            "use_case": [{"id": 4, "specification_id": 3}],
            "trace_link": [],
        },
    }

    assert _check_requirement_coverage_snapshot(snapshot) == []


def test_baseline_consistency_accepts_documented_requirement_exception():
    snapshot = {
        "project_id": 1,
        "entities": {
            "raw_requirement": [{
                "id": 1,
                "technical_notes": "Ngoại lệ: yêu cầu chỉ dùng cho báo cáo pháp lý.",
            }],
            "user_story": [],
            "specification": [],
            "use_case": [],
            "trace_link": [],
        },
    }

    assert _check_requirement_coverage_snapshot(snapshot) == []
