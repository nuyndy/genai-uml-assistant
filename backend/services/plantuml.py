import base64
import os

from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DEFAULT_PLANTUML_SERVER = "https://www.plantuml.com/plantuml"


class PlantUMLRenderError(RuntimeError):
    pass


def render_plantuml(source_code: str) -> str:
    """Render PlantUML directly through the public PlantUML server.

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

    server_url = (
        os.getenv("PLANTUML_SERVER_URL", DEFAULT_PLANTUML_SERVER).strip().rstrip("/")
        or DEFAULT_PLANTUML_SERVER
    )

    request = Request(
        f"{server_url}/svg",
        data=source.encode("utf-8"),
        headers={
            "Content-Type": "text/plain; charset=utf-8",
            "Accept": "image/svg+xml",
        },
        method="POST",
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
        raise PlantUMLRenderError(
            f"Máy chủ PlantUML trả về HTTP {exc.code}."
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

    # Do not accept an HTML/text error page as a valid diagram image.
    if b"<svg" not in image_bytes[:4096].lower():
        raise PlantUMLRenderError(
            "Máy chủ PlantUML không trả về SVG hợp lệ. "
            "Hãy kiểm tra cú pháp mã sơ đồ."
        )

    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"
