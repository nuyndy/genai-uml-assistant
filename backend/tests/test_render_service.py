import pytest
from fastapi.testclient import TestClient

from render_service import app

client = TestClient(app)

VALID_UML = "@startuml\nactor A as A1\nusecase U as U1\nA1 --> U1\n@enduml"


class _FakeResponse:
    def __init__(self, status_code: int = 200, content: bytes = b"<svg/>", text: str = ""):
        self.status_code = status_code
        self.content = content
        self.text = text


class _FakeClient:
    def __init__(self, response: _FakeResponse):
        self._response = response
        self.calls: list[tuple[str, bytes]] = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def post(self, url: str, content: bytes, headers: dict[str, str]):
        self.calls.append((url, content))
        return self._response


def test_health_reports_kroki_target(monkeypatch):
    monkeypatch.setenv("KROKI_URL", "https://kroki.io")
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_render_returns_data_url(monkeypatch):
    fake = _FakeClient(_FakeResponse(content=b"<svg>plantuml</svg>"))
    monkeypatch.setattr("render_service.httpx.Client", lambda *a, **k: fake)

    response = client.post("/render", json={"source_code": VALID_UML})

    assert response.status_code == 200
    image_url = response.json()["image_url"]
    assert image_url.startswith("data:image/svg;base64,")
    # Mã PlantUML được gửi thẳng dạng raw text, không bọc JSON.
    sent_url, sent_body = fake.calls[0]
    assert sent_url.endswith("/plantuml/svg")
    assert sent_body.decode("utf-8") == VALID_UML


def test_render_rejects_empty_source():
    response = client.post("/render", json={"source_code": "   "})
    assert response.status_code == 422


def test_render_rejects_source_without_startuml():
    response = client.post("/render", json={"source_code": "A1 --> U1"})
    assert response.status_code == 422


def test_render_reports_upstream_error(monkeypatch):
    fake = _FakeClient(
        _FakeResponse(status_code=400, text="Syntax Error", content=b"")
    )
    monkeypatch.setattr("render_service.httpx.Client", lambda *a, **k: fake)

    response = client.post("/render", json={"source_code": VALID_UML})

    assert response.status_code == 502
    assert "400" in response.json()["detail"]


def test_render_image_returns_binary_svg(monkeypatch):
    fake = _FakeClient(_FakeResponse(content=b"<svg>ok</svg>"))
    monkeypatch.setattr("render_service.httpx.Client", lambda *a, **k: fake)

    response = client.post("/render/image", json={"source_code": VALID_UML})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/svg")
    assert response.content == b"<svg>ok</svg>"
