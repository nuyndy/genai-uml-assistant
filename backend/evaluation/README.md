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


## Chạy benchmark thực tế

Từ thư mục `backend`, sau khi Ollama đang chạy và model đã được tải:

```bash
python -m evaluation.run_ai_quality --run-ollama
```

Báo cáo JSON mặc định được ghi vào `evaluation/latest_report.json`. Có thể chỉ định nơi lưu bằng `--report path/to/report.json`. Lệnh này gọi model thật và có thể mất thời gian tùy cấu hình máy.

Để chấm lại đầu ra đã lưu mà không gọi AI, tạo một file JSON ánh xạ ID sang **chuỗi chứa JSON đầu ra** rồi chạy:

```bash
python -m evaluation.run_ai_quality --outputs evaluation/my_outputs.json
```

Ví dụ cấu trúc file đầu vào:

```json
{
  "US-001": "{\"name\": \"Xem lịch học\", \"description\": \"Sinh viên xem lịch học\", \"acceptance_criteria\": [\"Sinh viên đã đăng nhập xem được lịch học\"]}"
}
```

Chỉ số `pass_rate` hiện tại là tỷ lệ ca đạt các kiểm tra cấu trúc xác định trong số ca đã chấm. Nó **không phải** tỷ lệ câu trả lời đúng về ngữ nghĩa. Báo cáo sẽ nêu các ca bị bỏ qua nếu không có đầu ra tương ứng.
