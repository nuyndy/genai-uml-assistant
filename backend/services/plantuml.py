import base64
import os
import zlib

from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DEFAULT_PLANTUML_SERVER = "https://www.plantuml.com/plantuml"
PLANTUML_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"


class PlantUMLRenderError(RuntimeError):
    pass


def _encode_plantuml(source: str) -> str:
    """Compress and encode PlantUML source using the server URL format."""
    compressor = zlib.compressobj(level=9, wbits=-15)
    compressed = compressor.compress(source.encode("utf-8")) + compressor.flush()
    encoded = []
    for offset in range(0, len(compressed), 3):
        chunk = compressed[offset:offset + 3]
        value = int.from_bytes(chunk, "big")
        value <<= (3 - len(chunk)) * 8
        encoded.append(PLANTUML_ALPHABET[(value >> 18) & 0x3F])
        encoded.append(PLANTUML_ALPHABET[(value >> 12) & 0x3F])
        if len(chunk) > 1:
            encoded.append(PLANTUML_ALPHABET[(value >> 6) & 0x3F])
        if len(chunk) > 2:
            encoded.append(PLANTUML_ALPHABET[value & 0x3F])
    return "".join(encoded)


def _apply_diagram_layout(source: str) -> str:
    """Ưu tiên hướng trái-sang-phải cho sơ đồ lớp, không đổi các loại sơ đồ khác."""
    lines = source.splitlines()
    if not lines or not any(line.lstrip().startswith("@startuml") for line in lines):
        return source

    # Chỉ áp dụng cho sơ đồ lớp, không tác động sequence/activity/use-case.
    has_class_declaration = any(
        line.lstrip().startswith(("class ", "abstract class ", "interface ", "entity "))
        for line in lines
    )
    if not has_class_declaration:
        return source

    if any(line.strip().lower() == "left to right direction" for line in lines):
        return source

    for index, line in enumerate(lines):
        if line.lstrip().startswith("@startuml"):
            lines.insert(index + 1, "left to right direction")
            break
    return "\n".join(lines)


def render_plantuml(source_code: str) -> str:
    """Render PlantUML through the public server using its encoded GET API.

    Returns a base64 data URL, preserving the existing database/API contract.
    PLANTUML_SERVER_URL may override the server base URL.
    """
    source = source_code.strip()
    if not source:
        raise PlantUMLRenderError("Mã PlantUML không được để trống.")

    if "@startuml" not in source or "@enduml" not in source:
        raise PlantUMLRenderError(
            "Mã PlantUML phải có @startuml và @enduml."
        )

    source = _apply_diagram_layout(source)

    server_url = (
        os.getenv("PLANTUML_SERVER_URL", DEFAULT_PLANTUML_SERVER).strip().rstrip("/")
        or DEFAULT_PLANTUML_SERVER
    )
    encoded_source = _encode_plantuml(source)
    request = Request(
        f"{server_url}/svg/{encoded_source}",
        headers={"Accept": "image/svg+xml", "User-Agent": "GenAI-UML-Assistant/1.0"},
        method="GET",
    )

    try:
        with urlopen(request, timeout=45) as response:
            content_type = (
                response.headers.get("Content-Type", "")
                .split(";", 1)[0]
                .strip()
                .lower()
            )
            image_bytes = response.read()
    except HTTPError as exc:
        detail = exc.read(500).decode("utf-8", errors="replace").strip()
        suffix = f" Chi tiết: {detail}" if detail else ""
        raise PlantUMLRenderError(
            f"Máy chủ PlantUML trả về HTTP {exc.code}.{suffix}"
        ) from exc
    except (URLError, TimeoutError, OSError, ValueError) as exc:
        raise PlantUMLRenderError(
            "Không kết nối được máy chủ PlantUML web. "
            "Hãy kiểm tra kết nối Internet hoặc thử lại sau."
        ) from exc

    if not image_bytes:
        raise PlantUMLRenderError("Máy chủ PlantUML trả về nội dung rỗng.")

    if content_type != "image/svg+xml":
        raise PlantUMLRenderError(
            "Máy chủ PlantUML trả về kiểu nội dung không hợp lệ: "
            f"{content_type or 'không xác định'}."
        )

    if b"<svg" not in image_bytes[:4096].lower():
        raise PlantUMLRenderError(
            "Máy chủ PlantUML không trả về SVG hợp lệ. "
            "Hãy kiểm tra cú pháp mã sơ đồ."
        )

    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"
