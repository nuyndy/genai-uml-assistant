import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from evaluation.run_ai_quality import score_output


def _case(case_id):
    cases = json.loads(
        (BACKEND_ROOT / "evaluation" / "ai_quality_cases.json").read_text(
            encoding="utf-8"
        )
    )
    return next(case for case in cases if case["id"] == case_id)


def test_score_output_accepts_valid_user_story_shape():
    case = _case("US-001")
    output = json.dumps({
        "name": "Xem lịch học",
        "description": "Sinh viên xem lịch học sau khi đăng nhập.",
        "acceptance_criteria": ["Sinh viên đã đăng nhập có thể xem lịch học."],
    })

    result = score_output(case, output)

    assert result["passed"] is True
    assert result["json_valid"] is True
    assert result["required_fields_present"] is True


def test_score_output_rejects_missing_acceptance_criteria():
    case = _case("US-001")
    output = json.dumps({
        "name": "Xem lịch học",
        "description": "Mô tả",
        "acceptance_criteria": [],
    })

    result = score_output(case, output)

    assert result["passed"] is False
    assert result["task_checks_passed"] is False


def test_score_output_reports_invalid_json():
    result = score_output(_case("UC-001"), "không phải JSON")

    assert result["passed"] is False
    assert result["json_valid"] is False
    assert "JSON không hợp lệ" in result["errors"][0]


def test_score_output_rejects_empty_main_flow():
    case = _case("UC-001")
    output = json.dumps({
        "name": "Xem lịch học",
        "main_flow": [],
        "alt_flow": [],
        "exception_flow": ["Người dùng chưa đăng nhập."],
    })

    result = score_output(case, output)

    assert result["passed"] is False
    assert "main_flow" in " ".join(result["errors"])



def test_score_output_checks_class_names_for_uml_case():
    case = _case("UML-001")
    output = json.dumps({
        "classes": [{"name": "SinhVien"}, {"name": "LichHoc"}],
        "relationships": [],
    })

    result = score_output(case, output)

    assert result["passed"] is True


def test_score_output_rejects_missing_traceability_ids():
    case = _case("SRS-001")
    output = json.dumps({
        "requirement_id": "FR-01",
        "user_story_id": "US-01",
        "use_case_id": "UC-OTHER",
        "traceability_status": "linked",
    })

    result = score_output(case, output)

    assert result["passed"] is False
    assert "ID" in " ".join(result["errors"])


def test_evaluation_dataset_covers_three_project_phases():
    cases = json.loads(
        (BACKEND_ROOT / "evaluation" / "ai_quality_cases.json").read_text(
            encoding="utf-8"
        )
    )

    assert {case["phase"] for case in cases} == {1, 2, 3}
    assert len(cases) >= 6
