"""
Dich vu render PlantUML trung gian cho backend.

Backend (services/plantuml.py) goi POST {PLANTUML_RENDER_URL}/render voi JSON
{"source_code": "..."} va chap nhan hoac {"image_url": "..."} hoac anh SVG/PNG
 truc tiep. Dich vu nay nhan dung hop do, roi chuyen tiep ma PlantUML sang
Kroki de render that.

Chay:
    python -m uvicorn render_service:app --host 127.0.0.1 --port 8080
"""

from __future__ import annotations

import base64
import os

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict

# Dich vu chay doc lap voi main.py nen phai tu nap .env, neu khong KROKI_* dat
# trong backend/.env se bi bo qua va service roi ve gia tri mac dinh.
load_dotenv()

KROKI_URL = os.getenv("KROKI_URL", "https://kroki.io").rstrip("/")
KROKI_TIMEOUT = float(os.getenv("KROKI_TIMEOUT_SECONDS", "45"))
OUTPUT_FORMAT = os.getenv("KROKI_OUTPUT_FORMAT", "png")
ALLOWED_FORMATS = {"png", "svg"}


class RenderRequest(BaseModel):
    """Noi dung backend gui len."""

    model_config = ConfigDict(extra="ignore")

    source_code: str


class RenderResponse(BaseModel):
    """Tra ve du kieu JSON khai bao san cho backend."""

    image_url: str


app = FastAPI(title="PlantUML Render Service", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "kroki": KROKI_URL, "format": OUTPUT_FORMAT}


def _resolve_media_type(response: httpx.Response) -> str:
    """Lay MIME that cua anh Kroki tra ve, khong doan theo OUTPUT_FORMAT.

    Kroki luon kem `Content-Type` dung (image/png hoac image/svg+xml). Dung
    header nay bao dam data URL khop voi noi dung, tranh Broken Image do khai
    bao PNG nhung noi dung la SVG hoac nguoc lai.
    """
    raw = (response.headers.get("content-type") or "").split(";")[0].strip().lower()
    if raw in {"image/png", "image/svg+xml"}:
        return raw
    # Kroki co the tra image/svg (thieu +xml) hoac image/jpeg khi cau hinh sai.
    if raw.startswith("image/"):
        return "image/svg+xml" if "svg" in raw else raw
    return "image/svg+xml" if OUTPUT_FORMAT == "svg" else "image/png"


def _reject_kroki_error_payload(response: httpx.Response) -> None:
    """Chan anh thong bao loi ma Kroki tra kem HTTP 200.

    Voi ma PlantUML sai cu phap, Kroki van tra 200 va mot anh chua thong bao
    loi. Neu khong kiem tra, he thong se luu anh loi nay nhu the la ket qua
    dung. PNG loi cua PlantUML thuong chua chuoi "Syntax Error"; SVG loi    thuong bat dau bang <?xml va chua dong chu do.
    """
    head = response.content[:2048]
    if b"Syntax Error" in head or b"syntax error" in head.lower():
        raise HTTPException(
            status_code=502,
            detail=(
                "Ma PlantUML sai cu phap nen Kroki tra ve anh thong bao loi. "
                "Hay kiem tra lai ma truoc khi luu."
            ),
        )


@app.post("/render", response_model=RenderResponse)
def render(request: RenderRequest) -> RenderResponse:
    source = request.source_code.strip()
    if not source:
        raise HTTPException(status_code=422, detail="source_code khong duoc de trong.")
    if "@startuml" not in source:
        raise HTTPException(status_code=422, detail="Thieu khoi dong @startuml.")

    try:
        with httpx.Client(timeout=KROKI_TIMEOUT) as client:
            response = client.post(
                f"{KROKI_URL}/plantuml/{OUTPUT_FORMAT}",
                content=source.encode("utf-8"),
                headers={"Content-Type": "text/plain; charset=utf-8"},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Khong ket noi duoc dich vu Kroki tai {KROKI_URL}.",
        ) from exc

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=(
                "Kroki khong render duoc ma PlantUML (HTTP "
                f"{response.status_code}): {response.text[:400]}"
            ),
        )
    if not response.content:
        raise HTTPException(status_code=502, detail="Kroki tra ve rong.")

    # Kroki tra HTTP 200 kem anh thong bao loi khi ma PlantUML sai cu phap.
    # Doan van ban do de nguoi dung biet can sua ma thay vi luu mot anh loi.
    _reject_kroki_error_payload(response)

    # Dung DUNG MIME Kroki tra ve. Neu tu gan "image/{OUTPUT_FORMAT}" trong khi
    # noi dung that la dinh dang khac, data URL se sai kieu va trinh duyet bao
    # Broken Image.
    media_type = _resolve_media_type(response)

    # Backend luu image_url vao database. Dinh dang data URL giu nguyen
    # hinh anh trong chinh DB, khong can them mot dich vu luu tru rieng.
    encoded = base64.b64encode(response.content).decode("ascii")
    return RenderResponse(image_url=f"data:{media_type};base64,{encoded}")


@app.post("/render/image")
def render_image(request: RenderRequest) -> Response:
    """Tra anh truc tiep thay vi data URL, dung khi can response nhe hon."""
    source = request.source_code.strip()
    if not source or "@startuml" not in source:
        raise HTTPException(status_code=422, detail="source_code khong hop le.")
    try:
        with httpx.Client(timeout=KROKI_TIMEOUT) as client:
            response = client.post(
                f"{KROKI_URL}/plantuml/{OUTPUT_FORMAT}",
                content=source.encode("utf-8"),
                headers={"Content-Type": "text/plain; charset=utf-8"},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Khong ket noi duoc Kroki.") from exc
    if response.status_code >= 400 or not response.content:
        raise HTTPException(status_code=502, detail="Kroki khong render duoc.")
    _reject_kroki_error_payload(response)
    return Response(
        content=response.content,
        media_type=_resolve_media_type(response),
    )
