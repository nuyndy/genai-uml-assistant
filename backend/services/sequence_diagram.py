"""Bộ dựng biểu đồ tuần tự PlantUML theo quy tắc xác định của ứng dụng."""


def _quoted(value: str) -> str:
    clean = " ".join(value.replace("\r", " ").replace("\n", " ").split())
    clean = clean.replace('"', '\\"').replace("@", "＠")
    return clean[:500]


def build_sequence_diagram_source(
    actor_name: str,
    project_name: str,
    use_case_name: str,
    main_flow: list[str],
    alt_flow: list[str],
    exception_flow: list[str],
) -> str:
    """Tạo mã PlantUML tuần tự, không gọi mô hình ngôn ngữ."""
    lines = [
        "@startuml",
        f'actor "{_quoted(actor_name)}" as A1',
        f'participant "{_quoted(project_name)}" as SYS',
    ]
    for index, item in enumerate(main_flow, start=1):
        lines.extend([
            f'A1 -> SYS : {_quoted(f"{index}. {item}")}',
            "activate SYS",
            f"A1 <-- SYS : Hoàn tất bước {index}",
            "deactivate SYS",
        ])
    for index, item in enumerate(alt_flow, start=1):
        lines.extend([
            f"alt Luồng phụ {index}: {_quoted(item)}",
            f"A1 -> SYS : Thực hiện luồng phụ {index}",
            f"A1 <-- SYS : Kết quả luồng phụ {index}",
            "end",
        ])
    if exception_flow:
        lines.extend(["note over SYS", *[_quoted(item) for item in exception_flow], "end note"])
    lines.extend([f"title {_quoted(use_case_name)}", "@enduml"])
    return "\n".join(lines)
