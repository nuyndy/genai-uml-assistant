from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.llm_service import call_llm
from pathlib import Path

router = APIRouter(prefix="/api/uml", tags=["UML Generator"])

class RequirementRequest(BaseModel):
    description: str
    language: str = "vi"   # vi hoặc en

_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def _read_prompt(filename: str) -> str:
    p = _PROMPTS_DIR / filename
    return p.read_text(encoding="utf-8")


def _strip_mermaid_fences(text: str) -> str:
    # Nếu LLM trả về ```mermaid ... ```, loại bỏ để mermaid parse được.
    t = text.strip()
    if t.startswith("```"):
        # dạng: ```mermaid\n...\n```
        parts = t.split("```")
        if len(parts) >= 3:
            inner = parts[1]
            # bỏ dòng đầu nếu là "mermaid"
            lines = inner.splitlines()
            if lines and lines[0].strip().lower() == "mermaid":
                return "\n".join(lines[1:]).strip()
            return inner.strip()
    return t

@router.post("/generate")
async def generate_uml(req: RequirementRequest):
    try:
        # 1) Use Case Specification
        spec_template = _read_prompt("use_case_spec.txt")
        spec_prompt = spec_template.format(description=req.description, language=req.language)
        spec = await call_llm(spec_prompt)

        # 2) Use Case Diagram (Mermaid)
        use_case_template = _read_prompt("use_case_diagram.txt")
        diagram_prompt = use_case_template.format(description=req.description, language=req.language)
        mermaid_code = await call_llm(diagram_prompt)
        mermaid_code = _strip_mermaid_fences(mermaid_code)

        # 3) Conceptual Class Diagram (Mermaid)
        class_template = _read_prompt("class_diagram.txt")
        class_prompt = class_template.format(description=req.description, language=req.language)
        class_mermaid = await call_llm(class_prompt)
        class_mermaid = _strip_mermaid_fences(class_mermaid)

        return {
            "use_case_spec": spec,
            "use_case_diagram": mermaid_code,
            "class_diagram": class_mermaid,
            "status": "success",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
