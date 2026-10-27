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
    acceptance_criteria = user_story.acceptance_criteria or "chưa có, hãy suy luận tiêu chí kiểm thử hợp lý từ User Story và đánh dấu phần cần xác nhận"
    fr_code = f"FR-{user_story.id:03d}"
    return f"""Bạn là chuyên gia phân tích yêu cầu phần mềm. Từ User Story sau:
- Vai trò: {user_story.role or 'chưa xác định'}
- Chức năng mong muốn: {user_story.feature}
- Lợi ích: {user_story.benefit or 'chưa nêu'}
- Tiêu chí chấp nhận đã có: {acceptance_criteria}

Hãy sinh ĐẶC TẢ YÊU CẦU CHỨC NĂNG (FR), không phải Use Case. Trả về duy nhất một JSON object đúng schema với ĐẦY ĐỦ TẤT CẢ các khóa bên dưới:
{{
  "function_code": "{fr_code}",
  "function_name": "Tên chức năng cụ thể",
  "description": "Mô tả mục tiêu, phạm vi và hành vi của chức năng",
  "actors": ["Từng vai trò/người dùng/hệ thống liên quan"],
  "process": ["Các bước xử lý nghiệp vụ theo thứ tự"],
  "input_data": ["Tên dữ liệu đầu vào và ý nghĩa"],
  "processing_rules": ["Điều kiện, kiểm tra, phân nhánh và xử lý lỗi phù hợp"],
  "output_data": ["Dữ liệu/kết quả/trạng thái/ thông báo đầu ra"],
  "acceptance_criteria": ["Các điều kiện kiểm thử có thể xác minh"],
  "business_rules": ["Quy tắc nghiệp vụ liên quan"],
  "field_mapping": [{{"field_name":"Tên trường thực tế suy ra từ yêu cầu","data_type":"String","required":true,"validation_rule":"Quy tắc kiểm tra phù hợp"}}]
}}

YÊU CẦU BẮT BUỘC:
1. Không được bỏ khóa nào, không để chuỗi rỗng, null hoặc mảng rỗng. Mỗi mảng phải có ít nhất một mục hữu ích, riêng field_mapping phải liệt kê các trường đầu vào/đầu ra liên quan khi có dữ liệu; nếu chức năng thực sự không trao đổi trường dữ liệu thì tạo một mục ghi "Không áp dụng — chức năng không có dữ liệu trường riêng" và giải thích ở validation_rule.
2. Phân tích riêng cho User Story này, không dùng nội dung chung chung lặp lại cho mọi FR. Tạo tối thiểu 2 bước process, 2 quy tắc xử lý nếu phù hợp và 2 tiêu chí chấp nhận có thể kiểm thử.
3. Không bịa quy định nghiệp vụ, số liệu, tên bảng hoặc tích hợp chưa có căn cứ. Nếu thiếu thông tin quan trọng, nêu giả định thận trọng và đánh dấu "Cần xác nhận" ngay trong trường tương ứng, đồng thời vẫn điền trường.
4. function_code phải chính xác là {fr_code}. Dùng tiếng Việt rõ ràng.
5. Không sinh các trường đặc trưng Use Case như tiền điều kiện, hậu điều kiện, luồng chính/thay thế/ngoại lệ hoặc mức ưu tiên.
6. Trước khi trả lời, tự rà soát đủ 11 khóa, đúng kiểu dữ liệu JSON, mọi trường đã có nội dung.
"""
def build_nonfunctional_spec_prompt(project_context: list[str]) -> str:
    context = json.dumps(project_context, ensure_ascii=False)
    groups = json.dumps(NONFUNCTIONAL_GROUPS, ensure_ascii=False)
    return f"""Bạn là chuyên gia yêu cầu phi chức năng. Dựa trên bối cảnh dự án, hãy sinh đặc tả NFR bằng tiếng Việt.
Bối cảnh: {context}

Trả về duy nhất JSON hợp lệ có đúng cấu trúc:
{{
  "items": [
    {{"group":"Hiệu năng & Dung lượng","criteria":"...","requirement":"...","metric":"...","conditions":"...","verification_method":"...","scope":"...","source":"..."}},
    {{"group":"Bảo mật & An toàn","criteria":"...","requirement":"...","metric":"...","conditions":"...","verification_method":"...","scope":"...","source":"..."}},
    {{"group":"Độ tin cậy & Khả dụng","criteria":"...","requirement":"...","metric":"...","conditions":"...","verification_method":"...","scope":"...","source":"..."}},
    {{"group":"Khả năng bảo trì & Mở rộng","criteria":"...","requirement":"...","metric":"...","conditions":"...","verification_method":"...","scope":"...","source":"..."}},
    {{"group":"Khả năng sử dụng & Tương thích","criteria":"...","requirement":"...","metric":"...","conditions":"...","verification_method":"...","scope":"...","source":"..."}}
  ]
}}

QUY TẮC BẮT BUỘC:
- Phải có chính xác 5 mục theo đúng thứ tự nhóm được nêu trong JSON mẫu.
- Mỗi mục phải điền đủ 8 trường group, criteria, requirement, metric, conditions, verification_method, scope, source; tuyệt đối không bỏ trường, không để chuỗi rỗng/null.
- criteria nêu thuộc tính chất lượng; requirement nêu hành vi/ràng buộc cụ thể và có thể kiểm chứng; metric nêu chỉ tiêu/ngưỡng đo hoặc cách đo cần xác nhận; conditions nêu điều kiện áp dụng; verification_method nêu bước kiểm chứng; scope nêu thành phần/phạm vi; source nêu căn cứ từ bối cảnh dự án hoặc "Cần xác nhận với chủ dự án".
- Không bịa số liệu, tiêu chuẩn hay hạ tầng. Nếu bối cảnh không đủ để kết luận ngưỡng, metric phải ghi "Cần xác nhận với chủ dự án; đề xuất đo bằng ..." và nêu cách đo đề xuất thay vì bỏ trống.
- Nội dung phải đặc thù theo dự án, không dùng cùng một câu chung cho cả 5 nhóm.
- Tự rà soát đủ 5 mục và 8 trường mỗi mục trước khi trả lời.
"""


def build_consolidated_functional_specs_prompt(user_stories: list[UserStoryPrompt]) -> str:
    """Prompt gọn để tổng hợp User Story thành FR có truy vết."""
    stories = [
        {
            "id": story.id,
            "role": story.role or "chưa xác định",
            "feature": story.feature,
            "benefit": story.benefit or "chưa nêu",
            "acceptance_criteria": story.acceptance_criteria or "chưa có",
        }
        for story in user_stories
    ]
    context = json.dumps(stories, ensure_ascii=False, separators=(",", ":"))
    return f"""Bạn là chuyên gia phân tích yêu cầu phần mềm. Tổng hợp các User Story dưới đây thành danh sách FR nghiệp vụ độc lập, cụ thể, kiểm thử được và không trùng lặp.
US: {context}

Quy tắc:
- Đối chiếu tất cả US trước khi gộp/tách; không mặc định mỗi US là một FR. Gộp cùng mục tiêu nghiệp vụ, tách hành vi độc lập.
- Bao phủ mọi US liên quan. source_user_story_ids chỉ chứa ID có trong đầu vào; một FR có thể liên kết nhiều US và ngược lại.
- Mã FR tuần tự FR-001, FR-002,...; viết tiếng Việt rõ ràng.
- Mỗi FR có các trường: function_code, function_name, description, actors, process, input_data, processing_rules, output_data, acceptance_criteria, business_rules, field_mapping, source_user_story_ids. field_mapping gồm field_name, data_type, required (boolean), validation_rule.
- Khi đủ căn cứ, có ít nhất 2 bước process và 2 tiêu chí chấp nhận kiểm thử được.
- Không bịa nghiệp vụ, số liệu, dữ liệu hoặc tích hợp; thiếu thông tin ghi "Cần xác nhận".
- Không thêm trường đặc trưng Use Case (tiền/hậu điều kiện, luồng chính/thay thế/ngoại lệ).
"""
