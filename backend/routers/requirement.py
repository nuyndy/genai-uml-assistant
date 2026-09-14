import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

router = APIRouter(prefix="/api", tags=["Requirements"])

# ==================== BƯỚC 0: ANALYZE REQUIREMENT ====================
class RequirementInput(BaseModel):
    text: str

class AnalysisOutput(BaseModel):
    is_complete: bool = Field(description="Đã đầy đủ các thành phần cơ bản chưa")
    missing_elements: list[str] = Field(description="Danh sách các thành phần còn thiếu")
    feedback: str = Field(description="Gợi ý chi tiết để người dùng hoàn thiện yêu cầu")

@router.post("/analyze-requirement", response_model=AnalysisOutput)
async def analyze_requirement(data: RequirementInput):
    try:
        model = genai.GenerativeModel(
            model_name="gemini-3.6-flash",
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": AnalysisOutput,
            }
        )
        prompt = f"""
        Bạn là chuyên gia Kỹ nghệ Yêu cầu (Requirements Engineering).
        Hãy kiểm tra và phân tích yêu cầu phần mềm dưới đây xem đã đủ thông tin chưa:
        "{data.text}"
        """
        response = model.generate_content(prompt)
        return AnalysisOutput.model_validate_json(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== BƯỚC 1: GENERATE UC SPECIFICATION ====================
class UCSpecification(BaseModel):
    uc_name: str = Field(description="Tên Use Case (VD: Đặt món ăn)")
    actor: str = Field(description="Tác nhân chính")
    description: str = Field(description="Mô tả ngắn gọn")
    pre_conditions: list[str] = Field(description="Tiền điều kiện")
    post_conditions: list[str] = Field(description="Hậu điều kiện")
    main_flow: list[str] = Field(description="Các bước trong luồng sự kiện chính")
    alternative_flows: list[str] = Field(description="Các luồng ngoại lệ/phụ")

@router.post("/generate-uc-spec", response_model=UCSpecification)
async def generate_uc_spec(data: RequirementInput):
    try:
        model = genai.GenerativeModel(
            model_name="gemini-3.6-flash",
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": UCSpecification,
            }
        )
        prompt = f"""
        Bạn là chuyên gia Kỹ nghệ Yêu cầu (Requirements Engineering).
        Dựa vào mô tả yêu cầu dưới đây:
        "{data.text}"
        
        Hãy đóng vai trò Analyst và sinh ra một bản Đặc tả Use Case (Use Case Specification) hoàn chỉnh.
        BẮT BUỘC phải điền thông tin chi tiết cho TẤT CẢ các trường dữ liệu sau, không được để trống trường nào:
        1. uc_name: Tên Use Case ngắn gọn.
        2. actor: Tác nhân thực hiện chính.
        3. description: Mô tả tóm tắt mục đích.
        4. pre_conditions: Danh sách điều kiện trước khi thực hiện.
        5. post_conditions: Danh sách kết quả sau khi hoàn thành.
        6. main_flow: Danh sách các bước trong luồng sự kiện chính (ví dụ: ["1. Người dùng bấm...", "2. Hệ thống..."]).
        7. alternative_flows: Danh sách các trường hợp ngoại lệ hoặc luồng phụ.
        """
        response = model.generate_content(prompt)
        return UCSpecification.model_validate_json(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))