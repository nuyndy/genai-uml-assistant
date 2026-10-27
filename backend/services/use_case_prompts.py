"""Prompt nghiệp vụ dùng chung cho sinh kịch bản Use Case."""

def build_use_case_scenario_prompt(use_case_name: str, specification_context: str) -> str:
    """Yêu cầu AI sinh đầy đủ thông tin chung, điều kiện và ba luồng kịch bản."""
    return (
        "Tạo kịch bản use case bằng tiếng Việt, chỉ dựa trên đặc tả và tên use case. "
        "BẮT BUỘC sinh đủ cả 8 trường: actor (tác nhân), description (mô tả), "
        "preconditions (tiền điều kiện), minimal_guarantees (đảm bảo tối thiểu), "
        "postconditions (hậu điều kiện), main_flow (luồng chính), alt_flow "
        "(luồng thay thế), exception_flow (ngoại lệ). Không bỏ trường nào. "
        "Mỗi trường là một mảng chuỗi có ít nhất một mục; alt_flow và exception_flow "
        "có thể dùng mảng rỗng nếu đặc tả không có nhánh phù hợp. "
        "Không bịa quy tắc hoặc dữ liệu; nếu thiếu chi tiết, ghi rõ điều cần xác nhận "
        "trong trường phù hợp. Tác nhân phải nhất quán với đặc tả. "
        "Trả JSON đúng schema, không thêm markdown: "
        "{\"actor\":[\"...\"],\"description\":[\"...\"],"
        "\"preconditions\":[\"...\"],\"minimal_guarantees\":[\"...\"],"
        "\"postconditions\":[\"...\"],\"main_flow\":[\"...\"],"
        "\"alt_flow\":[],\"exception_flow\":[]}.\n\n"
        f"USE CASE: {use_case_name}\n"
        f"ĐẶC TẢ:\n{specification_context}"
    )
