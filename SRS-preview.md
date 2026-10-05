# Tài liệu đặc tả yêu cầu phần mềm (SRS)

## 1. Giới thiệu
### 1.1 Mục đích
Mô tả yêu cầu chức năng và phi chức năng của hệ thống đặt hàng trực tuyến.

### 1.2 Phạm vi
Phạm vi gồm tạo đơn hàng từ giỏ hàng và các yêu cầu chất lượng liên quan.

### 1.3 Định nghĩa, thuật ngữ và từ viết tắt
SRS: tài liệu đặc tả yêu cầu phần mềm. UC: mã định danh chức năng.

## 2. Mô tả tổng thể
### 2.1 Các lớp người dùng
Khách hàng đã đăng ký tài khoản.

### 2.2 Môi trường vận hành
Ứng dụng web trên trình duyệt máy tính và thiết bị di động.

## 3. Yêu cầu đặc thù
### 3.1 Đặc tả chức năng

#### Đặt hàng trực tuyến

- Mã chức năng: UC01
- Tên chức năng: Tạo đơn hàng
- Mô tả: Khách hàng xác nhận giỏ hàng để tạo đơn hàng mới.
- Mức ưu tiên: Must
- Tác nhân: Khách hàng

##### Điều kiện tiên quyết

- Khách hàng đã đăng nhập.
- Giỏ hàng có ít nhất một sản phẩm.

##### Luồng chính

- 1. Khách hàng mở giỏ hàng.
- 2. Hệ thống kiểm tra tồn kho.
- 3. Khách hàng xác nhận đặt hàng.
- 4. Hệ thống lưu đơn hàng và hiển thị mã xác nhận.

##### Luồng thay thế

- 3a. Khách hàng quay lại chỉnh sửa giỏ hàng.

##### Luồng ngoại lệ

- 2a. Sản phẩm hết hàng, hệ thống thông báo và yêu cầu cập nhật giỏ hàng.

##### Điều kiện sau

- Đơn hàng được lưu với trạng thái chờ xử lý.

##### Quy tắc nghiệp vụ

- Chỉ cho phép đặt hàng khi giỏ hàng không rỗng.

##### Ánh xạ trường dữ liệu

| Tên trường | Kiểu dữ liệu | Bắt buộc | Quy tắc kiểm tra |
| --- | --- | --- | --- |
| Mã đơn hàng | String | Có | Duy nhất trong hệ thống. |

### 3.2 Đặc tả phi chức năng

#### Đặc tả phi chức năng

#### Hiệu năng & Dung lượng

- Tiêu chí: Tiêu chí kiểm chứng cho Hiệu năng & Dung lượng.
- Yêu cầu: Yêu cầu nhóm Hiệu năng & Dung lượng; ngưỡng cụ thể cần xác nhận khi triển khai.

#### Bảo mật & An toàn

- Tiêu chí: Tiêu chí kiểm chứng cho Bảo mật & An toàn.
- Yêu cầu: Yêu cầu nhóm Bảo mật & An toàn; ngưỡng cụ thể cần xác nhận khi triển khai.

#### Độ tin cậy & Khả dụng

- Tiêu chí: Tiêu chí kiểm chứng cho Độ tin cậy & Khả dụng.
- Yêu cầu: Yêu cầu nhóm Độ tin cậy & Khả dụng; ngưỡng cụ thể cần xác nhận khi triển khai.

#### Khả năng bảo trì & Mở rộng

- Tiêu chí: Tiêu chí kiểm chứng cho Khả năng bảo trì & Mở rộng.
- Yêu cầu: Yêu cầu nhóm Khả năng bảo trì & Mở rộng; ngưỡng cụ thể cần xác nhận khi triển khai.

#### Khả năng sử dụng & Tương thích

- Tiêu chí: Tiêu chí kiểm chứng cho Khả năng sử dụng & Tương thích.
- Yêu cầu: Yêu cầu nhóm Khả năng sử dụng & Tương thích; ngưỡng cụ thể cần xác nhận khi triển khai.

## 4. Phụ lục

Các ngưỡng hiệu năng cụ thể cần được xác nhận trong giai đoạn triển khai.
