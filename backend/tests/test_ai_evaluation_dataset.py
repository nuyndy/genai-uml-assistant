import json
from pathlib import Path

DATASET_PATH = Path(__file__).resolve().parents[1] / "evaluation" / "ai_quality_cases.json"


def _load_cases():
    return json.loads(DATASET_PATH.read_text(encoding="utf-8"))


def test_ai_evaluation_dataset_has_unique_stable_ids():
    cases = _load_cases()

    assert cases
    ids = [case["id"] for case in cases]
    assert len(ids) == len(set(ids))
    assert all(case["id"] for case in cases)


def test_ai_evaluation_cases_have_inputs_and_measurable_checks():
    for case in _load_cases():
        assert case["task"]
        assert case["input"].strip()
        assert case["expected"]["required_fields"]
        assert case["checks"]


def test_user_story_evaluation_requires_acceptance_criteria():
    user_story_case = next(
        case for case in _load_cases() if case["task"] == "user_story"
    )

    assert "acceptance_criteria" in user_story_case["expected"]["required_fields"]
    assert user_story_case["expected"]["minimum_acceptance_criteria"] >= 1


def test_use_case_evaluation_requires_main_flow():
    use_case_case = next(
        case for case in _load_cases() if case["task"] == "use_case_scenario"
    )

    assert "main_flow" in use_case_case["expected"]["required_fields"]
    assert use_case_case["expected"]["minimum_main_flow_steps"] >= 1
