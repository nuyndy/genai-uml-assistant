"""Chạy benchmark AI ngoại tuyến với đầu ra lưu sẵn hoặc trực tiếp qua Ollama.

Ví dụ:
    python -m evaluation.run_ai_quality --run-ollama
    python -m evaluation.run_ai_quality --outputs evaluation/sample_outputs.json
"""
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


def score_output(case: dict[str, Any], raw_output: str) -> dict[str, Any]:
    """Chấm các tiêu chí xác định; không tự nhận xét chất lượng ngữ nghĩa."""
    result: dict[str, Any] = {
        "id": case["id"],
        "task": case["task"],
        "json_valid": False,
        "required_fields_present": False,
        "task_checks_passed": False,
        "passed": False,
        "errors": [],
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
    required = case["expected"]["required_fields"]
    missing = [field for field in required if field not in payload]
    result["missing_fields"] = missing
    result["required_fields_present"] = not missing
    if missing:
        result["errors"].append("Thiếu trường bắt buộc: " + ", ".join(missing))

    task_checks: list[str] = []
    expected = case["expected"]
    if "minimum_acceptance_criteria" in expected:
        value = payload.get("acceptance_criteria")
        ok = isinstance(value, list) and len(value) >= expected["minimum_acceptance_criteria"]
        task_checks.append("acceptance_criteria_nonempty")
        if not ok:
            result["errors"].append("acceptance_criteria phải là danh sách có ít nhất "
                                    f'{expected["minimum_acceptance_criteria"]} phần tử.')
    if "minimum_main_flow_steps" in expected:
        value = payload.get("main_flow")
        ok = isinstance(value, list) and len(value) >= expected["minimum_main_flow_steps"]
        task_checks.append("main_flow_nonempty")
        if not ok:
            result["errors"].append("main_flow phải là danh sách có ít nhất "
                                    f'{expected["minimum_main_flow_steps"]} bước.')
    if case["task"] == "requirement_analysis":
        # Kiểm tra có giá trị văn bản, không đánh giá đúng/sai ngữ nghĩa.
        fields = ("actor", "action", "target_object", "purpose")
        ok = all(isinstance(payload.get(field), str) and payload[field].strip()
                 for field in fields)
        task_checks.append("actor_action_specific")
        if not ok:
            result["errors"].append(
                "actor/action/target_object/purpose phải là chuỗi không rỗng."
            )

    result["task_checks"] = task_checks
    result["task_checks_passed"] = all(
        (isinstance(payload.get("acceptance_criteria"), list)
         and len(payload["acceptance_criteria"]) >= expected["minimum_acceptance_criteria"])
        if check == "acceptance_criteria_nonempty" else
        (isinstance(payload.get("main_flow"), list)
         and len(payload["main_flow"]) >= expected["minimum_main_flow_steps"])
        if check == "main_flow_nonempty" else
        all(isinstance(payload.get(field), str) and payload[field].strip()
            for field in ("actor", "action", "target_object", "purpose"))
        for check in task_checks
    )
    result["passed"] = result["json_valid"] and result["required_fields_present"] and result["task_checks_passed"]
    return result


def build_prompt(case: dict[str, Any]) -> str:
    fields = case["expected"]["required_fields"]
    schema = {field: [] if field in ("acceptance_criteria", "main_flow", "alt_flow", "exception_flow")
              else "string" for field in fields}
    return (
        "Bạn hỗ trợ phân tích yêu cầu phần mềm. Dựa CHỈ trên đầu vào, không tự thêm "
        "tính năng hoặc dữ kiện chưa được nêu. Trả về duy nhất JSON object, không markdown.\n"
        f"Tác vụ: {case['task']}\n"
        f"Đầu vào: {case['input']}\n"
        f"Cấu trúc mong đợi (minh họa kiểu dữ liệu): {json.dumps(schema, ensure_ascii=False)}\n"
        "Với các trường dạng danh sách, hãy trả về danh sách JSON. Nếu thông tin chưa rõ, "
        "ghi rõ 'Chưa xác định' thay vì tự suy đoán."
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
            # Import bên trong để các kiểm tra offline không phụ thuộc dịch vụ Ollama.
            from services.ollama import generate_content
            raw_output = generate_content(build_prompt(case), json_response=True)
        if raw_output is None:
            results.append({
                "id": case["id"], "task": case["task"], "skipped": True,
                "reason": "Không có đầu ra; dùng --run-ollama hoặc --outputs.",
            })
            continue
        results.append(score_output(case, raw_output))

    evaluated = [item for item in results if not item.get("skipped")]
    passed = sum(bool(item.get("passed")) for item in evaluated)
    return {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "model": model_name if run_ollama else "đầu ra lưu sẵn",
        "dataset": DATASET_PATH.name,
        "summary": {
            "total_cases": len(cases),
            "evaluated_cases": len(evaluated),
            "skipped_cases": len(results) - len(evaluated),
            "passed_cases": passed,
            "pass_rate": round(passed / len(evaluated), 4) if evaluated else None,
        },
        "limitations": [
            "Chỉ số là kiểm tra cấu trúc xác định, không đo độ đúng ngữ nghĩa.",
            "Chưa tự động đo tính bịa, độ bao phủ truy vết hoặc sai lệch UML-SRS.",
        ],
        "results": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--run-ollama", action="store_true",
                       help="Gọi Ollama cho từng ca kiểm thử.")
    group.add_argument("--outputs", type=Path,
                       help="JSON ánh xạ ID ca kiểm thử sang đầu ra JSON dạng chuỗi.")
    parser.add_argument("--report", type=Path, default=ROOT / "evaluation" / "latest_report.json",
                        help="Đường dẫn lưu báo cáo (mặc định evaluation/latest_report.json).")
    args = parser.parse_args()

    try:
        report = run_benchmark(args.outputs, args.run_ollama)
    except Exception as exc:
        print(f"Lỗi chạy benchmark: {exc}", file=sys.stderr)
        return 2
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                           encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    print(f"Báo cáo: {args.report}")
    return 0 if report["summary"]["skipped_cases"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
