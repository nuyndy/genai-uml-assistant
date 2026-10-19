"""Prompt nghiệp vụ dùng chung cho sinh kịch bản Use Case."""

def build_use_case_scenario_prompt(use_case_name: str, specification_context: str) -> str:
    """Tạo prompt kịch bản dùng chung giữa endpoint và benchmark."""
    return (
        "Tạo kịch bản use case bằng tiếng Việt, chỉ dựa trên đặc tả và tên use case. "
        "Không bịa quy tắc hoặc dữ liệu; nếu thiếu chi tiết, nêu giả định cần xác nhận "
        "ngay trong bước liên quan. Trả JSON đúng schema: "
        "{\"main_flow\":[\"...\"],\"alt_flow\":[\"...\"],"
        "\"exception_flow\":[\"...\"]}. Mỗi phần tử là một bước ngắn.\n\n"
        f"USE CASE: {use_case_name}\n"
        f"ĐẶC TẢ:\n{specification_context}"
    )
