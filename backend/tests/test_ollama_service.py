import io
import json
from urllib.error import HTTPError, URLError
from unittest.mock import patch

import pytest

from services.ollama import AIServiceError, generate_content


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
    }
    assert urlopen.call_args.kwargs["timeout"] == 300
    assert result == '{"is_complete": true}'


def test_generate_content_reports_when_ollama_is_not_running():
    with patch("services.ollama.urlopen", side_effect=URLError("refused")):
        with pytest.raises(AIServiceError, match="Không kết nối được Ollama"):
            generate_content("Hello")


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
