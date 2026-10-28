"""Prompt nghiệp vụ dùng chung cho mô hình lớp UML."""


def build_class_diagram_prompt(use_case_context: str, specification_context: str) -> str:
    """Tạo prompt mô hình lớp bám sát yêu cầu nguồn, không ép AI bịa thành viên."""
    instructions = """
Bạn là chuyên gia phân tích và thiết kế hướng đối tượng UML. Hãy xây dựng mô hình lớp miền nghiệp vụ CHỈ dựa trên yêu cầu gốc, đặc tả chức năng và use case của chính hệ thống được cung cấp.

NGUỒN SỰ THẬT VÀ TRUY VẾT:
- Chỉ tạo lớp khi có căn cứ cụ thể trong yêu cầu, quy tắc nghiệp vụ, dữ liệu đầu vào/đầu ra hoặc luồng xử lý được mô tả. Mỗi lớp phải đại diện cho khái niệm nghiệp vụ hoặc trách nhiệm hệ thống có thể giải thích được bằng nguồn đã cho.
- Không suy diễn thêm lớp chỉ vì thường gặp trong các hệ thống tương tự; không thêm lớp framework/kỹ thuật như Service, Repository, Manager nếu nguồn không yêu cầu.
- Thuộc tính chỉ đưa vào khi nguồn có nêu dữ liệu/trạng thái cần lưu hoặc xử lý, hoặc dữ liệu đó được chỉ rõ trong luồng nghiệp vụ. Không tự bịa thuộc tính để đủ số lượng.
- Phương thức chỉ đưa vào khi hành vi tương ứng được thể hiện trong use case/đặc tả. Có thể diễn đạt hành động nghiệp vụ thành tên phương thức, nhưng không tạo hành vi mới.
- Quan hệ giữa hai lớp chỉ tạo khi có bằng chứng về liên kết dữ liệu/nghiệp vụ, sở hữu thành phần, kế thừa hoặc phụ thuộc. Không nối lớp chỉ để sơ đồ trông đầy đủ.
- Nếu không đủ căn cứ cho thuộc tính/phương thức, trả mảng rỗng tương ứng. Tuyệt đối không bịa để đạt một số lượng tối thiểu. Nếu đầu vào chưa đủ để xác định một lớp đáng tin cậy, không đưa lớp đó vào kết quả.
- Trước khi trả kết quả, tự kiểm tra từng lớp, thuộc tính, phương thức và quan hệ có căn cứ từ phần NGỮ CẢNH HỆ THỐNG VÀ YÊU CẦU GỐC hoặc ĐẶC TẢ CHỨC NĂNG hay không. Loại bỏ mọi phần chỉ là suy đoán.

NGÔN NGỮ BẮT BUỘC:
- Tên lớp, thuộc tính, phương thức và nhãn quan hệ dùng TIẾNG VIỆT KHÔNG DẤU, kể cả khi đầu vào có từ tiếng Anh; dịch nghĩa nghiệp vụ trước khi đặt tên.
- Tên lớp dùng PascalCase; tên thuộc tính và phương thức dùng camelCase. Không dùng từ tiếng Anh thông thường nếu có cách dịch tiếng Việt tương ứng.
- Không dấu tiếng Việt, không dấu cách, không gạch nối trong định danh. Chỉ giữ thuật ngữ tiếng Anh khi là tên riêng hoặc chuẩn kỹ thuật không có cách dịch phù hợp.

KHÔNG BỊA THÊM NGHIỆP VỤ:
- Không mặc định thêm SinhVien, GiangVien, SanPham, DonHang, BenhNhan hay bất kỳ lớp ví dụ nào nếu hệ thống đầu vào không thực sự có khái niệm đó.
- Không tự đổi miền nghiệp vụ theo ví dụ hoặc dữ liệu huấn luyện.
- Nếu nhiều nguồn mâu thuẫn hoặc thiếu thông tin, ưu tiên nội dung yêu cầu/đặc tả rõ ràng; không tự lấp khoảng trống bằng kiến thức chung.

Chỉ trả JSON đúng schema, không kèm giải thích ngoài JSON. Các tên trong ví dụ dưới đây chỉ là placeholder cấu trúc, không được sao chép thành dữ liệu nghiệp vụ:
{"classes":[{"name":"TenLopTheoNghiepVu","attributes":["thuocTinhNeuCoCanCu: String"],"methods":["hanhDongNeuCoCanCu()"]}],"relations":[{"class_a":"TenLopTheoNghiepVu","class_b":"TenLopLienQuan","relation_type":"association|inheritance|composition|aggregation|dependency"}]}
Nếu không có quan hệ đủ căn cứ, trả "relations": []. Mảng attributes hoặc methods có thể rỗng nếu nguồn không cung cấp đủ bằng chứng.
"""
    return (
        instructions
        + "\nNGỮ CẢNH HỆ THỐNG VÀ YÊU CẦU GỐC:\n"
        + (use_case_context or "(Không có use case được cung cấp)")
        + "\n\nĐẶC TẢ CHỨC NĂNG:\n"
        + (specification_context or "(Không có đặc tả chức năng được cung cấp)")
    )
