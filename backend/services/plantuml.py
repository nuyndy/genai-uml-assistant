import base64
import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class PlantUMLRenderError(RuntimeError):
    pass


def render_plantuml(source_code: str) -> str:
    # TODO: cần cấu hình PlantUML render service qua PLANTUML_RENDER_URL.
    service_url = os.getenv("PLANTUML_RENDER_URL", "").strip()
    if not service_url:
        raise PlantUMLRenderError(
            "Chưa cấu hình dịch vụ render PlantUML. Cần cấu hình PlantUML render service."
        )

    try:
        request = Request(
            f"{service_url.rstrip('/')}/render",
            data=json.dumps({"source_code": source_code}).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "application/json, image/*"},
            method="POST",
        )
        with urlopen(request, timeout=45) as response:
            content_type = response.headers.get_content_type()
            body = response.read()
    except HTTPError as exc:
        raise PlantUMLRenderError(
            f"Dịch vụ render PlantUML trả về HTTP {exc.code}."
        ) from exc
    except (URLError, TimeoutError, OSError, ValueError) as exc:
        raise PlantUMLRenderError(
            "Không kết nối được dịch vụ render PlantUML."
        ) from exc

    if not body:
        raise PlantUMLRenderError("Dịch vụ render PlantUML trả về ảnh rỗng.")

    if content_type == "application/json":
        try:
            payload = json.loads(body.decode("utf-8"))
            image_url = payload["image_url"]
        except (UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError) as exc:
            raise PlantUMLRenderError(
                "Dịch vụ render PlantUML trả về JSON thiếu image_url."
            ) from exc
        if not isinstance(image_url, str) or not image_url.strip():
            raise PlantUMLRenderError(
                "Dịch vụ render PlantUML trả về image_url không hợp lệ."
            )
        return image_url.strip()

    if content_type not in {"image/svg+xml", "image/png"}:
        raise PlantUMLRenderError(
            f"Dịch vụ render PlantUML trả về kiểu nội dung không hỗ trợ: {content_type}."
        )
    encoded = base64.b64encode(body).decode("ascii")
    return f"data:{content_type};base64,{encoded}"
