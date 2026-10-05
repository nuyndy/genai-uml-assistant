import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class AIServiceError(RuntimeError):
    pass


def generate_content(prompt: str, *, json_response: bool = False) -> str:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
    try:
        timeout = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "300"))
    except ValueError as exc:
        raise AIServiceError("OLLAMA_TIMEOUT_SECONDS phải là số giây nguyên.") from exc
    if timeout <= 0:
        raise AIServiceError("OLLAMA_TIMEOUT_SECONDS phải lớn hơn 0.")

    payload: dict[str, object] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }
    if json_response:
        payload["format"] = "json"

    request = Request(
        f"{base_url}/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        try:
            error_body = json.loads(exc.read().decode("utf-8"))
            message = error_body.get("error", "")
        except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
            message = ""
        suffix = f": {message}" if message else ""
        if exc.code == 404:
            raise AIServiceError(
                f"Không tìm thấy model Ollama '{model}'. Tải model bằng "
                f"`ollama pull {model}`{suffix}"
            ) from exc
        raise AIServiceError(
            f"Ollama từ chối yêu cầu (HTTP {exc.code}){suffix}"
        ) from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise AIServiceError(
            f"Không kết nối được Ollama tại {base_url}. Hãy mở Ollama và kiểm tra server."
        ) from exc
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise AIServiceError("Ollama trả về dữ liệu không hợp lệ.") from exc

    if not isinstance(result, dict):
        raise AIServiceError("Ollama trả về dữ liệu không hợp lệ.")
    text = result.get("response")
    if not isinstance(text, str) or not text.strip():
        raise AIServiceError("Ollama không trả về nội dung.")
    return text.strip()
