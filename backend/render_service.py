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
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict

KROKI_URL = os.getenv("KROKI_URL", "https://kroki.io").rstrip("/")
KROKI_TIMEOUT = float(os.getenv("KROKI_TIMEOUT_SECONDS", "45"))
OUTPUT_FORMAT = os.getenv("KROKI_OUTPUT_FORMAT", "svg")


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
    return {"status": "ok", "kroki": KROKI_URL}


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

    # Backend luu image_url vao database. Dinh dang data URL giu nguyen
    # hinh anh trong chinh DB, khong can them mot dich vu luu tru rieng.
    encoded = base64.b64encode(response.content).decode("ascii")
    return RenderResponse(
        image_url=f"data:image/{OUTPUT_FORMAT};base64,{encoded}"
    )


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
    return Response(
        content=response.content,
        media_type=f"image/{OUTPUT_FORMAT}",
    )
