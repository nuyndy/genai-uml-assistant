import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

_API_KEY = os.getenv("GEMINI_API_KEY")
if not _API_KEY:
    # Trả lỗi rõ ràng thay vì trả về text lỗi ở tầng dưới.
    raise RuntimeError(
        "Missing GEMINI_API_KEY. Hãy tạo file .env trong backend/ và đặt GEMINI_API_KEY=..."
    )

genai.configure(api_key=_API_KEY)

async def call_llm(prompt: str, model: str = "gemini-1.5-flash-latest") -> str:
    try:
        model_obj = genai.GenerativeModel(model)
        response = model_obj.generate_content(prompt)
        return response.text or ""
    except Exception as e:
        # Trả về chuỗi để backend convert thành detail, dễ debug.
        return f"Lỗi Gemini: {str(e)}"
