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


def build_functional_spec_prompt(user_story: UserStoryPrompt, uc_code: str = "") -> str:
    acceptance_criteria = user_story.acceptance_criteria or "chưa có, hãy đề xuất tiêu chí cần xác nhận"
    fr_code = f"FR-{user_story.id:03d}"
    return f"""Từ User Story: "Là {user_story.role or ''}, tôi muốn {user_story.feature}, để {user_story.benefit or ''}."
Tiêu chí chấp nhận đã có: {acceptance_criteria}
Mã đặc tả chức năng phải là {fr_code}; không dùng mã UC làm function_code.

Hãy sinh ĐẶC TẢ YÊU CẦU CHỨC NĂNG (FR), KHÔNG sinh đặc tả Use Case. Trả về CHỈ JSON hợp lệ:
{{
  "function_code": "{fr_code}",
  "function_name": "Tên yêu cầu chức năng",
  "description": "Giới thiệu và mô tả mục tiêu/phạm vi",
  "actors": ["Tác nhân liên quan"],
  "process": ["Các bước xử lý nghiệp vụ ở mức yêu cầu"],
  "input_data": ["Dữ liệu đầu vào"],
  "processing_rules": ["Logic, điều kiện, kiểm tra và nhánh xử lý"],
  "output_data": ["Kết quả đầu ra, trạng thái hoặc phản hồi"],
  "acceptance_criteria": ["Điều kiện kiểm tra để xác nhận yêu cầu đạt"],
  "business_rules": ["Quy tắc nghiệp vụ liên quan"],
  "field_mapping": [{{"field_name":"Tên trường","data_type":"String","required":true,"validation_rule":"Quy tắc kiểm tra"}}]
}}
Không sinh các trường đặc trưng UC như tiền điều kiện, hậu điều kiện, luồng chính, luồng thay thế, ngoại lệ; không sinh mức ưu tiên. Dùng tiếng Việt, bám sát User Story, không tự bịa nghiệp vụ. Nếu thiếu thông tin, ghi rõ cần xác nhận. Danh sách không có dữ liệu dùng mảng rỗng."""

def build_nonfunctional_spec_prompt(project_context: list[str]) -> str:
    context = json.dumps(project_context, ensure_ascii=False)
    groups = json.dumps(NONFUNCTIONAL_GROUPS, ensure_ascii=False)
    return f"""Dựa trên bối cảnh chức năng dự án, sinh đặc tả phi chức năng (NFR) bằng tiếng Việt.
Bối cảnh: {context}
Trả về JSON {"items":[{"group":"...","criteria":"...","requirement":"...","metric":"...","conditions":"...","verification_method":"...","scope":"...","source":"..."}]}.
items phải có đúng 5 phần tử theo thứ tự nhóm cố định: {groups}. criteria mô tả thuộc tính chất lượng/ràng buộc; requirement là yêu cầu cụ thể; metric là ngưỡng đo; conditions là điều kiện áp dụng; verification_method là cách kiểm chứng; scope là phạm vi; source là căn cứ. Không bịa số liệu; thiếu thông tin thì ghi cần xác nhận. Không dùng các trường luồng UC."""
