"""Chạy benchmark AI ngoại tuyến hoặc trực tiếp qua Ollama."""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "evaluation" / "ai_quality_cases.json"


def _contains_id(value: Any, expected_id: str) -> bool:
    if isinstance(value, str):
        return expected_id in value
    if isinstance(value, dict):
        return any(_contains_id(key, expected_id) or _contains_id(item, expected_id)
                   for key, item in value.items())
    if isinstance(value, list):
        return any(_contains_id(item, expected_id) for item in value)
    return False


def score_output(case: dict[str, Any], raw_output: str) -> dict[str, Any]:
    """Chấm cấu trúc và quy tắc xác định, không tự nhận xét chất lượng ngữ nghĩa."""
    result: dict[str, Any] = {
        "id": case["id"], "phase": case.get("phase"),
        "task": case["task"], "json_valid": False,
        "required_fields_present": False, "task_checks_passed": False,
        "passed": False, "errors": [],
    }
    try:
        payload = json.loads(raw_output)
    except (json.JSONDecodeError, TypeError) as exc:
        result["errors"].append(f"JSON không hợp lệ: {exc}")
        return result
    if not isinstance(payload, dict):
        result["errors"].append("Đầu ra JSON phải là một object.")
        return result

    result["json_valid"] = True
    expected = case["expected"]
    missing = [field for field in expected["required_fields"] if field not in payload]
    result["missing_fields"] = missing
    result["required_fields_present"] = not missing
    if missing:
        result["errors"].append("Thiếu trường bắt buộc: " + ", ".join(missing))

    checks: list[dict[str, Any]] = []
    def record(name: str, ok: bool, error: str) -> None:
        checks.append({"name": name, "passed": bool(ok)})
        if not ok:
            result["errors"].append(error)

    if "minimum_acceptance_criteria" in expected:
        value = payload.get("acceptance_criteria")
        record("acceptance_criteria_nonempty",
               isinstance(value, list) and len(value) >= expected["minimum_acceptance_criteria"],
               f'acceptance_criteria phải là danh sách có ít nhất {expected["minimum_acceptance_criteria"]} phần tử.')
    if "minimum_main_flow_steps" in expected:
        value = payload.get("main_flow")
        record("main_flow_nonempty",
               isinstance(value, list) and len(value) >= expected["minimum_main_flow_steps"],
               f'main_flow phải là danh sách có ít nhất {expected["minimum_main_flow_steps"]} bước.')
    if case["task"] == "requirement_analysis":
        fields = ("actor", "action", "target_object", "purpose")
        record("actor_action_specific",
               all(isinstance(payload.get(field), str) and payload[field].strip() for field in fields),
               "actor/action/target_object/purpose phải là chuỗi không rỗng.")
    if "minimum_classes" in expected:
        classes = payload.get("classes")
        record("minimum_classes",
               isinstance(classes, list) and len(classes) >= expected["minimum_classes"],
               f'classes phải có ít nhất {expected["minimum_classes"]} phần tử.')
    if "must_include_classes" in expected:
        classes = payload.get("classes")
        names = {item.get("name") for item in classes if isinstance(item, dict)} if isinstance(classes, list) else set()
        missing_names = [name for name in expected["must_include_classes"] if name not in names]
        record("required_class_names", not missing_names,
               "Thiếu lớp UML bắt buộc: " + ", ".join(missing_names))
    if "minimum_messages" in expected:
        messages = payload.get("messages")
        record("minimum_messages",
               isinstance(messages, list) and len(messages) >= expected["minimum_messages"],
               f'messages phải có ít nhất {expected["minimum_messages"]} phần tử.')
    if "expected_ids" in expected:
        ids_present = all(_contains_id(payload, item) for item in expected["expected_ids"])
        record("traceability_ids_present", ids_present,
               "Thiếu một hoặc nhiều ID trong liên kết truy vết mong đợi.")
    if "minimum_issues" in expected:
        issues = payload.get("issues")
        record("consistency_issue_detected",
               isinstance(issues, list) and len(issues) >= expected["minimum_issues"],
               f'issues phải có ít nhất {expected["minimum_issues"]} vấn đề được phát hiện.')

    result["task_checks"] = checks
    result["task_checks_passed"] = all(check["passed"] for check in checks)
    result["passed"] = result["json_valid"] and result["required_fields_present"] and result["task_checks_passed"]
    return result


def build_prompt(case: dict[str, Any]) -> str:
    fields = case["expected"]["required_fields"]
    array_fields = {
        "acceptance_criteria", "main_flow", "alt_flow", "exception_flow",
        "classes", "relationships", "lifelines", "messages", "issues",
    }
    schema = {field: [] if field in array_fields else "string" for field in fields}
    return (
        "Bạn hỗ trợ phân tích và mô hình hóa phần mềm. Chỉ sử dụng dữ liệu đầu vào; "
        "không tự thêm yêu cầu, lớp, quan hệ hoặc kết luận chưa có căn cứ. "
        "Trả về duy nhất một JSON object, không markdown.\n"
        f"Giai đoạn: {case.get('phase', 'không xác định')}\n"
        f"Tác vụ: {case['task']}\n"
        f"Đầu vào: {case['input']}\n"
        f"Cấu trúc tối thiểu mong đợi: {json.dumps(schema, ensure_ascii=False)}\n"
        "Với trường dạng danh sách, hãy trả về danh sách JSON. Nếu không đủ dữ liệu, "
        "nêu rõ giới hạn trong trường phù hợp thay vì suy đoán."
    )


def run_benchmark(outputs_path: Path | None, run_ollama: bool) -> dict[str, Any]:
    cases = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    supplied: dict[str, str] = {}
    if outputs_path:
        raw = json.loads(outputs_path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            raise ValueError("File đầu ra phải là JSON object ánh xạ case ID sang chuỗi JSON.")
        supplied = {str(key): value for key, value in raw.items() if isinstance(value, str)}

    results = []
    model_name = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
    for case in cases:
        raw_output = supplied.get(case["id"])
        if raw_output is None and run_ollama:
            from services.ollama import generate_content
            raw_output = generate_content(build_prompt(case), json_response=True)
        if raw_output is None:
            results.append({"id": case["id"], "phase": case.get("phase"),
                             "task": case["task"], "skipped": True,
                             "reason": "Không có đầu ra; dùng --run-ollama hoặc --outputs."})
            continue
        results.append(score_output(case, raw_output))

    evaluated = [item for item in results if not item.get("skipped")]
    passed = sum(bool(item.get("passed")) for item in evaluated)
    by_phase = {}
    for phase in (1, 2, 3):
        subset = [item for item in evaluated if item.get("phase") == phase]
        by_phase[str(phase)] = {
            "evaluated_cases": len(subset),
            "passed_cases": sum(bool(item.get("passed")) for item in subset),
            "pass_rate": round(sum(bool(item.get("passed")) for item in subset) / len(subset), 4)
                         if subset else None,
        }
    return {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "model": model_name if run_ollama else "đầu ra lưu sẵn",
        "dataset": DATASET_PATH.name,
        "summary": {
            "total_cases": len(cases), "evaluated_cases": len(evaluated),
            "skipped_cases": len(results) - len(evaluated), "passed_cases": passed,
            "pass_rate": round(passed / len(evaluated), 4) if evaluated else None,
            "by_phase": by_phase,
        },
        "limitations": [
            "Chỉ số là kiểm tra cấu trúc và quy tắc xác định, không đo độ đúng ngữ nghĩa.",
            "Nhận diện ID/lớp và đếm phần tử không chứng minh liên kết truy vết hay UML đúng về nghiệp vụ.",
            "Chưa tự động đo tính bịa bằng đánh giá ngữ nghĩa; cần rà soát chuyên gia hoặc LLM-as-a-judge.",
        ],
        "results": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--run-ollama", action="store_true", help="Gọi Ollama cho từng ca kiểm thử.")
    group.add_argument("--outputs", type=Path, help="JSON ánh xạ ID ca sang đầu ra JSON dạng chuỗi.")
    parser.add_argument("--report", type=Path, default=ROOT / "evaluation" / "latest_report.json")
    args = parser.parse_args()
    try:
        report = run_benchmark(args.outputs, args.run_ollama)
    except Exception as exc:
        print(f"Lỗi chạy benchmark: {exc}", file=sys.stderr)
        return 2
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    print(f"Báo cáo: {args.report}")
    return 0 if report["summary"]["skipped_cases"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
