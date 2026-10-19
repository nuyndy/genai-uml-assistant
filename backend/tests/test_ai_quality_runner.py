import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from evaluation.run_ai_quality import run_benchmark, score_output, build_prompt


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
        "role": "Sinh viên",
        "feature": "xem lịch học của mình sau khi đăng nhập",
        "benefit": "biết được lịch học",
        "acceptance_criteria": "Sinh viên đã đăng nhập có thể xem lịch học của mình.",
    })

    result = score_output(case, output)

    assert result["passed"] is True
    assert result["json_valid"] is True
    assert result["required_fields_present"] is True


def test_score_output_rejects_missing_acceptance_criteria():
    case = _case("US-001")
    output = json.dumps({
        "role": "Sinh viên",
        "feature": "xem lịch học",
        "benefit": "biết lịch học",
        "acceptance_criteria": "",
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
        "relations": [],
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



def test_benchmark_report_keeps_prompt_and_raw_output_for_reproduction(tmp_path):
    case = _case("US-001")
    output = json.dumps({
        "role": "Sinh viên",
        "feature": "xem lịch học",
        "benefit": "biết lịch học",
        "acceptance_criteria": "Sinh viên đã đăng nhập có thể xem lịch học.",
    })
    outputs_path = tmp_path / "outputs.json"
    outputs_path.write_text(json.dumps({"US-001": output}), encoding="utf-8")

    report = run_benchmark(outputs_path=outputs_path, run_ollama=False)
    result = next(item for item in report["results"] if item["id"] == "US-001")

    assert result["raw_output"] == output
    assert "Chuyển yêu cầu phần mềm sau thành bản nháp User Story" in result["prompt"]
    assert "Dựa duy nhất trên dữ liệu đầu vào" in result["prompt"]
    assert result["output_source"] == "saved_output"
    assert report["generation_config"]["prompt_mode"] == "task_specific_production_and_generic_prompts"
    assert any("các tác vụ còn lại vẫn dùng prompt benchmark chung" in item for item in report["limitations"])



def test_user_story_benchmark_matches_production_schema():
    case = _case("US-001")
    assert case["expected"]["required_fields"] == [
        "role", "feature", "benefit", "acceptance_criteria"
    ]
    assert case["expected"]["acceptance_criteria_type"] == "string"

    output = json.dumps({
        "role": "Sinh viên",
        "feature": "xem lịch học",
        "benefit": "biết lịch học",
        "acceptance_criteria": "Sinh viên đã đăng nhập có thể xem lịch học.",
    })
    result = score_output(case, output)

    assert result["passed"] is True


def test_user_story_benchmark_uses_production_prompt_builder():
    from services.requirement_prompts import build_user_story_prompt
    case = _case("US-001")

    assert case["input"]["actor"] == "Sinh viên"
    assert build_prompt(case) == build_user_story_prompt(case["input"])



def test_use_case_benchmark_uses_production_prompt_builder():
    from services.use_case_prompts import build_use_case_scenario_prompt
    case = _case("UC-001")

    assert case["expected"]["required_fields"] == [
        "main_flow", "alt_flow", "exception_flow"
    ]
    assert case["expected"]["production_schema"] == "UseCaseScenarioSuggestion"
    assert build_prompt(case) == build_use_case_scenario_prompt(
        case["input"]["use_case_name"], case["input"]["specification_context"]
    )
    assert "USE CASE: Xem lịch học" in build_prompt(case)


def test_class_uml_benchmark_uses_production_prompt_builder():
    from services.uml_prompts import build_class_diagram_prompt
    case = _case("UML-001")

    assert case["expected"]["required_fields"] == ["classes", "relations"]
    assert case["expected"]["production_schema"] == "ClassDiagramSuggestion"
    assert build_prompt(case) == build_class_diagram_prompt(
        case["input"]["use_case_context"],
        case["input"]["specification_context"],
    )
    assert '"relations":[' in build_prompt(case)
