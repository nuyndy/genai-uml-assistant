import json
from typing import Protocol


NONFUNCTIONAL_GROUPS = (
    "Hiệu năng & Dung lượng",
    "Bảo mật & An toàn",
    "Độ tin cậy & Khả dụng",
    "Khả năng bảo trì & Mở rộng",
    "Khả năng sử dụng & Tương thích",
)


class UserStoryPrompt(Protocol):
    id: int
    role: str | None
    feature: str
    benefit: str | None
    acceptance_criteria: str | None


def build_functional_spec_prompt(user_story: UserStoryPrompt, uc_code: str) -> str:
    acceptance_criteria = (
        user_story.acceptance_criteria or "chưa có, hãy tự đề xuất"
    )
    fr_code = f"FR-{user_story.id:03d}"
    return f"""Từ User Story: "Là {user_story.role or ''}, tôi muốn {user_story.feature}, để {user_story.benefit or ''}."
Tiêu chí chấp nhận đã có: {acceptance_criteria}
Mã Use Case tham chiếu: {uc_code}\nMã đặc tả chức năng phải theo định dạng FR-{getattr(user_story, "id", 0):03d}; không dùng mã UC làm function_code.

Hãy sinh ĐẶC TẢ CHỨC NĂNG đầy đủ bằng tiếng Việt, trả về CHỈ JSON hợp lệ theo ĐÚNG cấu trúc sau, không thêm markdown hay văn bản ngoài JSON:
{{
  "function_code": "{fr_code}",
  "function_name": "Tên chức năng",
  "description": "Mô tả ngắn",
  "actors": ["Tác nhân 1"],
  "priority": "Must",
  "pre_conditions": ["..."],
  "main_flow": ["1. ..."],
  "alternative_flows": ["..."],
  "exception_flows": ["..."],
  "post_conditions": ["..."],
  "business_rules": ["..."],
  "field_mapping": [
    {{"field_name": "Email", "data_type": "String", "required": true, "validation_rule": "..."}}
  ]
}}
priority phải là một trong Must, Should, Could, Won't. Các trường danh sách không có dữ liệu dùng mảng rỗng."""


def build_nonfunctional_spec_prompt(project_context: list[str]) -> str:
    context = json.dumps(project_context, ensure_ascii=False)
    groups = json.dumps(NONFUNCTIONAL_GROUPS, ensure_ascii=False)
    return f"""Dựa trên bối cảnh các chức năng của dự án sau, đề xuất đặc tả phi chức năng bằng tiếng Việt.
Bối cảnh: {context}
Trả về CHỈ JSON hợp lệ theo đúng cấu trúc {{"items":[{{"group":"...","criteria":"...","requirement":"..."}}]}}.
items phải có đúng 5 phần tử theo đúng thứ tự và nhóm cố định sau: {groups}.
criteria là tiêu chí có thể kiểm chứng; requirement nêu yêu cầu cụ thể. Không tự khẳng định số liệu chưa có căn cứ; nếu thiếu, ghi rõ cần xác nhận."""
