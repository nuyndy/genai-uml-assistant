"""Prompt nghiệp vụ dùng chung cho mô hình lớp UML."""


def build_class_diagram_prompt(use_case_context: str, specification_context: str) -> str:
    """Tạo prompt mô hình lớp có đủ thành viên và tên định danh chuẩn UML."""
    instructions = """
Bạn là chuyên gia phân tích và thiết kế hướng đối tượng UML. Hãy suy luận mô hình lớp miền nghiệp vụ CHỈ từ toàn bộ use case, đặc tả chức năng và ngữ cảnh hệ thống được cung cấp.

NGÔN NGỮ BẮT BUỘC:
- Toàn bộ tên lớp, thuộc tính, phương thức và nhãn quan hệ phải dùng TIẾNG VIỆT KHÔNG DẤU, kể cả khi dữ liệu đầu vào có từ tiếng Anh.
- Dịch ý nghĩa nghiệp vụ tiếng Anh sang tiếng Việt trước khi đặt tên. Ví dụ minh họa cách chuyển đổi: Customer -> KhachHang, Order -> DonHang, paymentDate -> ngayThanhToan, calculateTotal() -> tinhTongTien(). Đây chỉ là ví dụ dịch thuật, KHÔNG được tự thêm các lớp này nếu nghiệp vụ đầu vào không có.
- Tên lớp dùng PascalCase; tên thuộc tính và phương thức dùng camelCase. Không dùng từ tiếng Anh như Customer, Manager, Service, Repository, User, Product, Order hoặc các từ tiếng Anh tương tự nếu có cách gọi tiếng Việt tương ứng.
- Không dấu tiếng Việt, không dấu cách, không gạch nối trong định danh. Chỉ giữ nguyên thuật ngữ tiếng Anh khi đó là tên riêng/chuẩn kỹ thuật không có cách dịch phù hợp, không phải tên nghiệp vụ thông thường.

Không chỉ trả tên lớp: mỗi lớp phải có ít nhất 2 thuộc tính và 1 phương thức cụ thể, có căn cứ từ dữ liệu đầu vào. Thuộc tính mô tả dữ liệu/trạng thái mà lớp quản lý; phương thức mô tả hành vi/nghiệp vụ mà lớp thực hiện. Không dùng các mục chung chung như 'id', 'data', 'process()', 'handle()' nếu không có căn cứ nghiệp vụ.
Ưu tiên lớp thực thể và lớp điều khiển nghiệp vụ thực sự cần thiết; tránh lớp trùng nghĩa hoặc lớp framework chung chung. Bao phủ các nghiệp vụ quan trọng và tạo quan hệ giữa các lớp khi có căn cứ.

KHÔNG BỊA THÊM NGHIỆP VỤ: tuyệt đối không mặc định hoặc tự thêm các lớp quen thuộc như SinhVien, GiangVien, SanPham, DonHang, BenhNhan hay bất kỳ lớp nào chỉ vì chúng xuất hiện trong ví dụ hoặc dữ liệu huấn luyện. Tên lớp, thuộc tính, phương thức và quan hệ đều phải được suy ra từ use case/đặc tả CỦA HỆ THỐNG ĐANG PHÂN TÍCH. Không đưa lớp ví dụ vào kết quả trừ khi đầu vào thực sự yêu cầu lớp đó.

Chỉ trả JSON đúng schema. Dùng các chuỗi dưới đây làm chỗ giữ chỗ để hiểu CẤU TRÚC; không sao chép chúng thành dữ liệu nghiệp vụ:
{"classes":[{"name":"TenLopTheoNghiepVu","attributes":["thuocTinhA: String","thuocTinhB: String"],"methods":["hanhDongNghiepVu()"]}],"relations":[{"class_a":"TenLopTheoNghiepVu","class_b":"TenLopLienQuanTheoNghiepVu","relation_type":"association|inheritance|composition|aggregation|dependency"}]}
Mỗi lớp phải có ít nhất 2 thuộc tính và 1 phương thức; suy luận từ hành vi được mô tả nếu đầu vào chưa nêu trực tiếp, không để hai mảng này rỗng. Nếu không có quan hệ đủ căn cứ, trả relations là [].
"""
    return (
        instructions
        + "\nNGỮ CẢNH HỆ THỐNG VÀ YÊU CẦU GỐC:\n"
        + (use_case_context or "(Không có use case được cung cấp)")
        + "\n\nĐẶC TẢ CHỨC NĂNG:\n"
        + (specification_context or "(Không có đặc tả chức năng được cung cấp)")
    )
