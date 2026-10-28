"""Prompt nghiệp vụ dùng chung cho mô hình lớp UML."""


def build_class_diagram_prompt(use_case_context: str, specification_context: str) -> str:
    """Tạo prompt mô hình lớp có đủ thành viên và tên định danh chuẩn UML."""
    return (
        "Bạn là chuyên gia phân tích và thiết kế hướng đối tượng UML. Hãy suy luận "
        "mô hình lớp miền nghiệp vụ CHỈ từ toàn bộ use case và đặc tả chức năng được cung cấp. "
        "Không chỉ trả tên lớp: mỗi lớp phải có ít nhất 2 thuộc tính và 1 phương thức cụ thể, "
        "có căn cứ từ dữ liệu đầu vào. Thuộc tính mô tả dữ liệu/trạng thái mà lớp quản lý; "
        "phương thức mô tả hành vi/nghiệp vụ mà lớp thực hiện. Không dùng các mục chung chung "
        "như 'id', 'data', 'process()', 'handle()' nếu không có căn cứ nghiệp vụ. "
        "Ưu tiên lớp thực thể và lớp điều khiển nghiệp vụ thực sự cần thiết; tránh lớp trùng "
        "nghĩa hoặc lớp framework chung chung. Bao phủ các nghiệp vụ quan trọng và tạo quan hệ "
        "giữa các lớp khi có căn cứ.

"
        "KHÔNG BỊA THÊM NGHIỆP VỤ: tuyệt đối không mặc định hoặc tự thêm các lớp quen thuộc "
        "như SinhVien, GiangVien, SanPham, DonHang, BenhNhan hay bất kỳ lớp nào chỉ vì chúng "
        "xuất hiện trong ví dụ hoặc dữ liệu huấn luyện. Tên lớp, thuộc tính, phương thức và "
        "quan hệ đều phải được suy ra từ use case/đặc tả CỦA HỆ THỐNG ĐANG PHÂN TÍCH. "
        "Nếu đầu vào là hệ thống khám bệnh thì mô hình phải phản ánh nghiệp vụ khám bệnh; "
        "nếu là hệ thống khác thì chỉ tạo các lớp thuộc hệ thống đó. Không đưa lớp ví dụ vào "
        "kết quả trừ khi đầu vào thực sự yêu cầu lớp đó.

"
        "QUY TẮC TÊN ĐỊNH DANH: tên lớp dùng tiếng Việt không dấu theo PascalCase; tên thuộc "
        "tính và phương thức dùng tiếng Việt không dấu theo camelCase. Ví dụ về QUY TẮC là "
        "viết liền, không dấu và đúng kiểu chữ; các ví dụ không phải danh sách lớp được phép "
        "mặc định. Không dùng dấu tiếng Việt, dấu cách hoặc dấu gạch nối trong định danh. "
        "Không dùng tên tiếng Anh nếu nghiệp vụ có tên tiếng Việt tương ứng. Không đặt cả câu "
        "mô tả vào tên thuộc tính/phương thức. Thuộc tính là định danh ngắn, có thể kèm kiểu "
        "dữ liệu; phương thức là tên hành động có ngoặc và có thể kèm tham số/kiểu trả về. "
        "Giữ chính xác cùng tên lớp ở hai đầu quan hệ.

"
        "Chỉ trả JSON đúng schema. Dùng các chuỗi dưới đây làm chỗ giữ chỗ để hiểu CẤU TRÚC; "
        "không sao chép chúng thành dữ liệu nghiệp vụ:
"
        "{\"classes\":[{\"name\":\"TenLopTheoNghiepVu\","
        "\"attributes\":[\"thuocTinhA: String\",\"thuocTinhB: String\"],"
        "\"methods\":[\"hanhDongNghiepVu()\"]}],"
        "\"relations\":[{\"class_a\":\"TenLopTheoNghiepVu\","
        "\"class_b\":\"TenLopLienQuanTheoNghiepVu\","
        "\"relation_type\":\"association|inheritance|composition|aggregation|dependency\"}]}. "
        "Mỗi lớp phải có ít nhất 2 thuộc tính và 1 phương thức; suy luận từ hành vi được mô tả "
        "nếu đầu vào chưa nêu trực tiếp, không để hai mảng này rỗng. Nếu không có quan hệ "
        "đủ căn cứ, trả relations là [].

"
        f"USE CASE:\n{use_case_context}\n\nĐẶC TẢ:\n{specification_context}"
    )
