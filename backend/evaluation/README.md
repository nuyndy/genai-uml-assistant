# Thử nghiệm đánh giá chất lượng AI

Thư mục này phục vụ thực nghiệm của khóa luận, không chạy trong luồng request của ứng dụng.

## Mục tiêu

Đánh giá đầu ra AI theo hai lớp riêng biệt:

1. **Chỉ số xác định bằng mã (CI, không cần gọi AI):**
   - JSON đầu ra có cấu trúc hợp lệ.
   - Có đủ các trường bắt buộc của mẫu.
   - Có tiêu chí chấp nhận khi kiểm tra một yêu cầu.
   - Có liên kết truy vết đến Use Case/SRS khi bộ dữ liệu yêu cầu.
2. **Đánh giá ngữ nghĩa (thực nghiệm thủ công hoặc LLM-as-a-judge):**
   - Độ đầy đủ, tính nhất quán và nội dung bịa.
   - Ghi lại model, prompt/version, dữ liệu kiểm thử và kết quả để tái lập.
   - Có thể thử nghiệm DeepEval trong môi trường nghiên cứu riêng; không thêm DeepEval vào dependency chạy ứng dụng cho đến khi xác nhận cách gọi model phù hợp với cấu hình Ollama hiện tại.

## Chạy kiểm tra

Từ thư mục `backend`:

```bash
python -m pytest tests/test_ai_evaluation_dataset.py
```

Các kiểm tra này **không chứng minh chất lượng ngữ nghĩa của AI**. Chúng xác nhận bộ dữ liệu và quy tắc chấm điểm xác định hoạt động đúng. Để báo cáo kết quả khóa luận, cần chạy cùng bộ câu hỏi nhiều lần hoặc trên các model khác nhau và ghi nhận kết quả thực tế; không suy diễn số liệu khi chưa chạy thử.

## Định dạng bộ dữ liệu

Mỗi ca có mã ổn định, loại tác vụ, đầu vào, đầu ra mẫu tối thiểu và tiêu chí kiểm tra. Khi mở rộng, giữ nguyên ID để có thể so sánh phiên bản model/prompt theo thời gian.
