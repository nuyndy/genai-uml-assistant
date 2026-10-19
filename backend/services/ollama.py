import json
import os
import re
import socket
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class AIServiceError(RuntimeError):
    pass


# JSON đôi khi bị model bọc trong khối markdown ```json ... ```.
_CODE_FENCE_RE = re.compile(
    r"^```(?:json)?\s*|\s*```$",
    flags=re.IGNORECASE,
)


def strip_code_fence(text: str) -> str:
    """Bỏ khối markdown ```json ... ``` mà model có thể bọc quanh JSON.

    Dùng chung cho mọi endpoint để tránh tình trạng Giai đoạn 2 chấp nhận
    JSON có fence còn Giai đoạn 1 thì không.
    """
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = _CODE_FENCE_RE.sub("", cleaned).strip()
    return cleaned


def _parse_timeout() -> int:
    try:
        timeout = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "300"))
    except ValueError as exc:
        raise AIServiceError("OLLAMA_TIMEOUT_SECONDS phải là số giây nguyên.") from exc
    if timeout <= 0:
        raise AIServiceError("OLLAMA_TIMEOUT_SECONDS phải lớn hơn 0.")
    return timeout


def _build_options(json_response: bool) -> dict[str, object]:
    """Tham số sinh.

    Tác vụ trích xuất JSON cần đầu ra ổn định, nên hạ temperature xuống 0 và
    cố định seed để cùng prompt cho cùng kết quả.
    """
    try:
        temperature = float(os.getenv("OLLAMA_TEMPERATURE", "0"))
    except ValueError as exc:
        raise AIServiceError("OLLAMA_TEMPERATURE phải là một số.") from exc
    options: dict[str, object] = {"temperature": temperature}
    if json_response:
        options["seed"] = 0
    return options


def generate_content(prompt: str, *, json_response: bool = False) -> str:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
    timeout = _parse_timeout()

    payload: dict[str, object] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": _build_options(json_response),
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
        # Không dùng `with urlopen(...)`: `__exit__` của response sẽ ĐÓNG đối tượng
        # trả về. Khi đối tượng đó được chia sẻ (ví dụ mock trong test hoặc lần gọi
        # lại trong cùng một tiến trình), việc đóng này làm lần đọc sau ném
        # `ValueError: I/O operation on closed file`. Đọc xong rồi đóng thủ công,
        # bọc trong try/except để nơi cung cấp không có `.close()` cũng không sao.
        response = urlopen(request, timeout=timeout)
        try:
            result = json.loads(response.read().decode("utf-8"))
        finally:
            close = getattr(response, "close", None)
            if callable(close):
                close()
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
    except (TimeoutError, socket.timeout) as exc:
        # Timeout KHÁC với "server không chạy": Ollama vẫn sống nhưng quá chậm.
        # Thường gặp ở lần gọi đầu tiên vì model phải nạp từ đĩa vào RAM.
        raise AIServiceError(
            f"Ollama không phản hồi trong {timeout}s (model '{model}' có thể đang "
            f"được nạp lần đầu). Thử lại, hoặc tăng OLLAMA_TIMEOUT_SECONDS."
        ) from exc
    except (URLError, OSError) as exc:
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


# Model nhỏ hay đổi tên khóa. Ánh xạ các biến thể thường gặp về đúng schema.
_KEY_ALIASES: dict[str, str] = {
    "title": "name",
    "feature": "name",
    "actor": "name",
    "actor_name": "name",
    "use_case": "name",
    "use_case_name": "name",
    "usecase": "name",
    "usecases": "suggested_use_cases",
    "actors": "suggested_actors",
    "main_flow": "main_flow",
    "alt_flows": "alt_flow",
    "alternative_flows": "alt_flow",
    "exceptions": "exception_flow",
    "exception_flows": "exception_flow",
}


# Các khóa mà giá trị phải là DANH SÁCH nhưng model hay bọc trong {"items": [...]}.
_LIST_KEYS = {
    "suggested_actors",
    "suggested_use_cases",
    "classes",
    "relations",
    "results",
    "main_flow",
    "alt_flow",
    "exception_flow",
}


def _unwrap_list(value: object) -> object:
    """Nếu model trả `{"items": [...]}` cho một trường phải là mảng, mở ra."""
    if isinstance(value, dict):
        for key in ("items", "list", "data", "values", "result"):
            inner = value.get(key)
            if isinstance(inner, list):
                return inner
    return value


def _normalize_keys(value: object) -> object:
    """Đổi tên khóa biến thể (title, feature, actor_name...) về đúng schema."""
    if isinstance(value, list):
        return [_normalize_keys(item) for item in value]
    if not isinstance(value, dict):
        return value
    normalized: dict[str, object] = {}
    for key, item in value.items():
        target = _KEY_ALIASES.get(key, key)
        normalized[target] = _normalize_keys(item)
    return normalized


def _repair_payload(payload: object, model: type | None = None) -> object:
    """Sửa các sai lệch cấu trúc phổ biến mà không làm mất ý nghĩa dữ liệu."""
    if not isinstance(payload, dict):
        return payload

    repaired: dict[str, object] = {}
    is_user_story = model is not None and model.__name__ == "UserStoryDraftContent"
    for key, value in payload.items():
        target_key = key
        if is_user_story:
            # Model nhỏ đôi khi gọi feature là name/title/description.
            aliases = {
                "name": "feature",
                "title": "feature",
                "description": "feature",
                "acceptanceCriteria": "acceptance_criteria",
                "acceptance criteria": "acceptance_criteria",
            }
            target_key = aliases.get(key, key)
            # Tiêu chí chấp nhận phải là chuỗi; nếu AI trả danh sách, giữ từng
            # tiêu chí trên một dòng thay vì làm mất nội dung.
            if target_key == "acceptance_criteria" and isinstance(value, list):
                value = ". ".join(
                    str(item).strip() for item in value if item is not None and str(item).strip()
                )
        else:
            target_key = _KEY_ALIASES.get(key, key)
            if target_key in _LIST_KEYS:
                value = _unwrap_list(value)
            value = _normalize_keys(value)

        # Không ghi đè trường đúng đã có bằng một alias xuất hiện sau đó.
        if target_key not in repaired or key == target_key:
            repaired[target_key] = value
    return repaired


def _validate_json(value: object, model: type) -> object:
    """Chuẩn hoá đầu ra AI thành JSON rồi kiểm tra theo Pydantic model.

    Chấp nhận cả chuỗi JSON (đầu ra thật của Ollama) lẫn dict đã parse sẵn
    (dùng trong test) để một hàm dùng chung cho mọi trường hợp.
    """
    from pydantic import ValidationError

    if isinstance(value, str):
        payload = json.loads(strip_code_fence(value))
    else:
        payload = value
    try:
        return model.model_validate(payload)
    except ValidationError:
        # Thử lại sau khi sửa các lệch cấu trúc phổ biến; nếu vẫn sai thì để
        # lỗi gốc nổi lên và tầng retry phía trên xử lý.
        return model.model_validate(_repair_payload(payload, model))


def json_contract(model: type) -> str:
    """Khối ràng buộc định dạng sinh trực tiếp từ schema của `model`.

    Model nhỏ (qwen2.5:3b) hay trả {"suggested_actors": {"items": [...]}} hoặc
    đổi khóa thành "title". Khối này nói rõ: trường danh sách PHẢI là mảng
    phẳng, không bọc object, không đổi tên khóa.
    """
    schema = model.model_json_schema()
    properties = schema.get("properties", {})
    required = schema.get("required", list(properties))
    list_fields = [
        key for key, spec in properties.items() if spec.get("type") == "array"
    ]
    lines = [
        "YÊU CẦU ĐỊNH DẠNG NGHIÊM NGẶT:",
        "- Chỉ trả về DUY NHẤT một đối tượng JSON chứa DỮ LIỆU THỰC TẾ, không kèm markdown, không giải thích.",
        "- Đây là JSON của KẾT QUẢ, KHÔNG phải JSON Schema. TUYỆT ĐỐI không trả về các khóa mô tả schema như properties, type, description, required, title.",
        "- Không sao chép schema mẫu làm kết quả. Hãy điền giá trị thực tế cho từng trường theo nội dung yêu cầu.",
        "- Các trường sau BẮT BUỘC có mặt: " + ", ".join(required) + ".",
    ]
    if list_fields:
        lines.append(
            "- Các trường sau PHẢI là MẢNG phẳng (ký hiệu [ ... ]), TUYỆT ĐỐI "
            'không bọc trong object hay trong khóa "items": '
            + ", ".join(list_fields)
            + "."
        )
    lines.append(
        "- Dùng ĐÚNG tên khóa trong schema; KHÔNG thay bằng từ đồng nghĩa "
        "(không dùng title, feature, actor_name thay cho name)."
    )
    lines.append(f"- Schema đầy đủ: {json.dumps(schema, ensure_ascii=False)}")
    return "\n".join(lines)


def generate_json(prompt: str, model: type, *, attempts: int = 2) -> object:
    """Gọi AI và bắt buộc trả về JSON đúng `model`.

    Mọi prompt đều được nối thêm `json_contract(model)` để ràng buộc định dạng
    ngay từ đầu; nếu vẫn sai, thử lại một lần nữa kèm mô tả đúng lỗi để AI tự
    sửa thay vì trả lỗi 502 ngay cho người dùng.
    """
    from pydantic import ValidationError

    base_prompt = f"{prompt}\n\n{json_contract(model)}"
    current_prompt = base_prompt
    last_error: Exception | None = None
    for attempt in range(1, max(1, attempts) + 1):
        response = generate_content(current_prompt, json_response=True)
        try:
            return _validate_json(response, model)
        except (json.JSONDecodeError, ValidationError, TypeError, ValueError) as exc:
            last_error = exc
            if attempt >= attempts:
                break
            current_prompt = (
                f"{base_prompt}\n\n"
                "LẦN TRƯỚC SAI ĐỊNH DẠNG. Hãy tạo lại kết quả từ đầu. "
                "Chỉ trả về một đối tượng JSON chứa GIÁ TRỊ DỮ LIỆU THỰC TẾ, không phải JSON Schema. "
                "Không được trả các khóa properties, type, description, required hoặc sao chép schema. "
                "Điền đủ các trường bắt buộc theo nội dung đầu vào; không chắc thì ghi rõ cần xác nhận. "
                "Không kèm markdown hay văn bản giải thích. "
                f"Lỗi cần khắc phục: {exc}"
            )
    raise AIServiceError(
        f"AI trả về dữ liệu không đúng cấu trúc yêu cầu: {last_error}"
    )
