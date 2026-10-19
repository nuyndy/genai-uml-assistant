"""Prompt nghiệp vụ dùng chung cho bước tạo User Story."""

import json


def build_user_story_prompt(content: dict) -> str:
    """Tạo prompt User Story từ nội dung yêu cầu đã chuẩn hóa."""
    return (
        "Chuyển yêu cầu phần mềm sau thành bản nháp User Story có thể kiểm duyệt. "
        "Phân tích và điền đủ role, feature, benefit, acceptance_criteria; "
        "Dựa duy nhất trên dữ liệu đầu vào; không tự tạo vai trò, quy tắc nghiệp vụ, "
        "điều kiện hay hành vi không được nêu. Có thể diễn đạt lại cho rõ ràng. "
        "Nếu trường nào chưa có đủ căn cứ, ghi rõ '[Cần xác nhận: ...]' thay vì "
        "tự bịa dữ kiện. Trả về JSON hợp lệ với đủ các khóa role, feature, benefit, "
        "acceptance_criteria; tất cả đều là chuỗi không rỗng.\n\n"
        f"Yêu cầu: {json.dumps(content, ensure_ascii=False)}"
    )
