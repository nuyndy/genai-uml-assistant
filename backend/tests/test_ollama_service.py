import io
import json
from urllib.error import HTTPError, URLError
from unittest.mock import patch

import pytest

from schemas.requirement import UserStoryDraftContent
from schemas.uml import ExtractActorsUseCasesResult
from services.ollama import AIServiceError, generate_content, generate_json


def test_generate_content_calls_local_ollama_and_requests_json():
    response = io.BytesIO(
        json.dumps({"response": '{"is_complete": true}'}).encode("utf-8")
    )
    with patch.dict(
        "os.environ",
        {
            "OLLAMA_BASE_URL": "http://localhost:11434/",
            "OLLAMA_MODEL": "qwen2.5:3b",
        },
        clear=True,
    ), patch("services.ollama.urlopen", return_value=response) as urlopen:
        result = generate_content("Analyze this", json_response=True)

    request = urlopen.call_args.args[0]
    assert request.full_url == "http://localhost:11434/api/generate"
    assert request.get_method() == "POST"
    assert json.loads(request.data) == {
        "model": "qwen2.5:3b",
        "prompt": "Analyze this",
        "stream": False,
        "format": "json",
        # temperature 0 và seed cố định để đầu ra JSON ổn định giữa các lần chạy.
        "options": {"temperature": 0.0, "seed": 0},
    }
    assert urlopen.call_args.kwargs["timeout"] == 300
    assert result == '{"is_complete": true}'


def test_generate_content_reports_when_ollama_is_not_running():
    with patch("services.ollama.urlopen", side_effect=URLError("refused")):
        with pytest.raises(AIServiceError, match="Không kết nối được Ollama"):
            generate_content("Hello")


def test_generate_content_phan_biet_timeout_voi_server_khong_chay():
    # Timeout KHÔNG phải "Ollama chưa mở": Ollama vẫn sống nhưng chậm (thường do
    # nạp model lần đầu). Thông báo phải nói đúng để không đổ lỗi sai cho người dùng.
    with patch("services.ollama.urlopen", side_effect=TimeoutError("timed out")):
        with pytest.raises(AIServiceError, match="Ollama không phản hồi") as exc:
            generate_content("Hello")
    assert "Không kết nối được" not in str(exc.value)


def test_generate_content_explains_when_model_is_not_installed():
    error = HTTPError(
        "http://localhost:11434/api/generate",
        404,
        "Not Found",
        {},
        io.BytesIO(b'{"error":"model not found"}'),
    )
    with patch("services.ollama.urlopen", side_effect=error):
        with pytest.raises(AIServiceError, match="ollama pull qwen2.5:3b"):
            generate_content("Hello")


def test_generate_content_rejects_invalid_timeout():
    with patch.dict("os.environ", {"OLLAMA_TIMEOUT_SECONDS": "0"}):
        with pytest.raises(AIServiceError, match="phải lớn hơn 0"):
            generate_content("Hello")


def _ollama_response(text: str) -> io.BytesIO:
    return io.BytesIO(json.dumps({"response": text}).encode("utf-8"))


def _ollama_responder(text: str):
    """Mock `urlopen` trả về một stream MỚI cho mỗi lần gọi.

    `generate_content` đọc xong sẽ đóng response (đúng như hành vi với kết nối
    thật). Nếu dùng chung một `BytesIO` qua `return_value`, lần gọi thứ hai khi
    `generate_json` thử lại sẽ đọc đúng đối tượng đã bị đóng và ném
    `ValueError: I/O operation on closed file`.
    """
    return lambda *args, **kwargs: _ollama_response(text)


def test_generate_json_appends_strict_format_contract():
    """Prompt gửi đi phải kèm ràng buộc mảng phẳng và cấm đổi tên khóa."""
    payload = {"suggested_actors": [], "suggested_use_cases": []}
    with patch(
        "services.ollama.urlopen", return_value=_ollama_response(json.dumps(payload))
    ) as urlopen:
        generate_json("Nội dung yêu cầu", ExtractActorsUseCasesResult)

    sent_prompt = json.loads(urlopen.call_args.args[0].data)["prompt"]
    assert "YÊU CẦU ĐỊNH DẠNG NGHIÊM NGẶT" in sent_prompt
    assert "MẢNG phẳng" in sent_prompt
    assert "suggested_actors" in sent_prompt
    assert "suggested_use_cases" in sent_prompt
    # Nhắc rõ không được dùng từ đồng nghĩa cho khóa name.
    assert "title" in sent_prompt


def test_generate_json_repairs_items_wrapper_and_title_key():
    """Model trả {"items": [{"title": ...}]} cho mảng phải là list[dict name].

    Đây đúng là lỗi thực tế gặp ở endpoint trích xuất tác nhân/use case.
    """
    payload = {
        "suggested_actors": {"items": [{"title": "Sinh viên"}]},
        "suggested_use_cases": {
            "items": [{"title": "Đăng ký môn", "description": "Sinh viên đăng ký."}]
        },
    }
    with patch(
        "services.ollama.urlopen",
        # Stream mới mỗi lần gọi: model sinh lại ở lần thử thứ hai.
        side_effect=_ollama_responder(json.dumps(payload)),
    ):
        result = generate_json("prompt", ExtractActorsUseCasesResult)

    assert [actor.name for actor in result.suggested_actors] == ["Sinh viên"]
    assert [item.name for item in result.suggested_use_cases] == ["Đăng ký môn"]


def test_generate_json_retries_when_model_returns_schema_instead_of_data():
    """Model có thể nhầm trả JSON Schema; lần retry phải yêu cầu dữ liệu thực tế."""
    schema_response = {
        "description": "Nội dung user story",
        "properties": {
            "role": {"title": "Role", "type": "string"},
            "feature": {"title": "Feature", "type": "string"},
            "benefit": {"title": "Benefit", "type": "string"},
            "acceptance_criteria": {"title": "Acceptance Criteria", "type": "string"},
        },
        "required": ["role", "feature", "benefit", "acceptance_criteria"],
        "type": "object",
    }
    valid_response = {
        "role": "Khách hàng",
        "feature": "đăng nhập",
        "benefit": "truy cập tài khoản của mình",
        "acceptance_criteria": "Hệ thống xác thực thông tin đăng nhập",
    }
    with patch(
        "services.ollama.urlopen",
        side_effect=[
            _ollama_response(json.dumps(schema_response)),
            _ollama_response(json.dumps(valid_response)),
        ],
    ) as urlopen:
        result = generate_json("Tạo User Story", UserStoryDraftContent)

    assert result.role == "Khách hàng"
    assert result.feature == "đăng nhập"
    assert urlopen.call_count == 2
    retry_prompt = json.loads(urlopen.call_args.args[0].data)["prompt"]
    assert "không phải JSON Schema" in retry_prompt
    assert "properties" in retry_prompt


def test_generate_json_repairs_user_story_feature_alias_and_acceptance_list():
    """Chuẩn hóa name thành feature và gộp tiêu chí dạng list thành chuỗi."""
    payload = {
        "role": "Sinh viên",
        "name": "quản lý tài khoản",
        "benefit": "có thể tự quản lý thông tin",
        "acceptance_criteria": [
            "Sinh viên xem được thông tin tài khoản",
            "Sinh viên không có quyền chỉnh sửa",
        ],
    }
    with patch(
        "services.ollama.urlopen",
        return_value=_ollama_response(json.dumps(payload, ensure_ascii=False)),
    ):
        result = generate_json("Tạo User Story", UserStoryDraftContent)

    assert result.feature == "quản lý tài khoản"
    assert result.acceptance_criteria == (
        "Sinh viên xem được thông tin tài khoản. "
        "Sinh viên không có quyền chỉnh sửa"
    )


def test_generate_json_strips_markdown_fence():
    payload = {"suggested_actors": [{"name": "Khách"}], "suggested_use_cases": []}
    text = f"```json\n{json.dumps(payload)}\n```"
    with patch("services.ollama.urlopen", return_value=_ollama_response(text)):
        result = generate_json("prompt", ExtractActorsUseCasesResult)

    assert result.suggested_actors[0].name == "Khách"


def test_generate_json_retries_then_raises_with_reason():
    """Sai cấu trúc không sửa được thì thử lại rồi báo lỗi kèm nguyên nhân."""
    with patch(
        "services.ollama.urlopen",
        side_effect=_ollama_responder(json.dumps({"unexpected": True})),
    ) as urlopen:
        with pytest.raises(AIServiceError, match="không đúng cấu trúc"):
            generate_json("prompt", ExtractActorsUseCasesResult)

    # Gọi lần đầu + một lần sửa lỗi.
    assert urlopen.call_count == 2