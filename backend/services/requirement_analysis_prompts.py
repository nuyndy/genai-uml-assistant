"""Prompt dùng chung cho phân tích độ đầy đủ của yêu cầu."""


import json


def build_requirement_analysis_prompt(content: dict) -> str:
    """Tạo prompt đúng với đầu vào và schema RequirementAnalysis của endpoint."""
    conditions = content.get("pre_conditions", [])
    rules = content.get("business_rules", [])
    natural_description = (
        f"Với vai trò {content.get('actor', '')}, người dùng muốn "
        f"{content.get('action', '')} {content.get('target_object', '')} "
        f"để {content.get('purpose', '')}."
    )
    return (
        "Đánh giá tính đầy đủ và rõ ràng của yêu cầu phần mềm sau để có thể "
        "đặc tả đúng chức năng được mô tả. Chỉ đánh giá thông tin liên quan "
        "trực tiếp đến chức năng, tác nhân, hành động, đối tượng, mục đích, "
        "điều kiện trước và quy tắc nghiệp vụ. Không yêu cầu định dạng tài liệu, "
        "phông chữ, mã hóa ký tự hoặc các chi tiết không liên quan. Không suy "
        "diễn rằng các trường dữ liệu hay quy trình chưa nêu là bắt buộc nếu "
        "chúng không cần thiết để hiểu chức năng. Không tự bịa dữ kiện còn thiếu. "
        "Chỉ liệt kê thông tin cụ thể còn thiếu mà thực sự ngăn cản việc đặc tả. "
        "Chỉ trả về JSON hợp lệ theo cấu trúc "
        '{"is_complete": boolean, "missing_elements": [string], '
        '"feedback": string}. Đặt is_complete=false nếu còn thiếu dữ kiện '
        "cần thiết hoặc diễn đạt mơ hồ.\n\n"
        f"Mô tả: {natural_description}\n"
        f"Điều kiện trước: {json.dumps(conditions, ensure_ascii=False)}\n"
        f"Quy tắc nghiệp vụ: {json.dumps(rules, ensure_ascii=False)}"
    )
