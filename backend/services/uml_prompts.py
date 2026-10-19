"""Prompt nghiệp vụ dùng chung cho mô hình lớp UML."""


def build_class_diagram_prompt(use_case_context: str, specification_context: str) -> str:
    """Tạo prompt mô hình lớp từ use case và đặc tả chức năng."""
    return (
        "Suy luận mô hình lớp UML bằng tiếng Việt từ các use case và đặc tả dưới đây. "
        "Chỉ đề xuất lớp, thuộc tính, phương thức có căn cứ trong nghiệp vụ; không "
        "tạo lớp framework chung chung. Trả JSON đúng schema: "
        "{\"classes\":[{\"name\":\"...\",\"attributes\":[\"...\"],"
        "\"methods\":[\"...\"]}],\"relations\":[{\"class_a\":\"...\","
        "\"class_b\":\"...\",\"relation_type\":\"association|inheritance|"
        "composition|aggregation|dependency\"}]}. Nếu không có quan hệ, dùng [].\n\n"
        f"USE CASE:\n{use_case_context}\n\nĐẶC TẢ:\n{specification_context}"
    )
