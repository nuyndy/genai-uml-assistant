# Nhật ký thay đổi — nhánh `luong_moi`

- Thời điểm thực hiện: 2026-10-26
- Commit gốc: `849d35cb6c446f5ac812a98032f8886558e6dc80`
- Phạm vi: chỉ di chuyển các tệp ứng viên vào `_cho_xoa/`; không xóa vĩnh viễn.
- Mục tiêu: giữ nguyên logic hiện hành, loại các tệp legacy/để trống khỏi vị trí mã nguồn đang hoạt động nhưng vẫn bảo toàn bản gốc để có thể khôi phục.
- Lưu ý kiểm thử: không có môi trường chạy build/test của repo được thực thi trong thao tác GitHub này; cần chạy CI/build sau khi đồng bộ nhánh.

## Các tệp đã di chuyển

| Đường dẫn cũ | Đường dẫn mới | Lý do |
|---|---|---|
| `frontend/src/types/requirement.ts` | `_cho_xoa/frontend/src/types/requirement.ts` | Tệp rỗng (0 byte), không chứa định nghĩa hay logic. |
| `frontend/src/components/step1/Step1Requirement.tsx` | `_cho_xoa/frontend/src/components/step1/Step1Requirement.tsx` | Thành phần legacy không nằm trong luồng import trực tiếp của App/current GiaiDoan; được chuyển cùng nhóm phụ thuộc nội bộ để bảo toàn mã và có thể khôi phục. |
| `frontend/src/components/step1/EarsPreviewCard.tsx` | `_cho_xoa/frontend/src/components/step1/EarsPreviewCard.tsx` | Thành phần legacy không nằm trong luồng import trực tiếp của App/current GiaiDoan; được chuyển cùng nhóm phụ thuộc nội bộ để bảo toàn mã và có thể khôi phục. |
| `frontend/src/components/step1/ContextDiagramCard.tsx` | `_cho_xoa/frontend/src/components/step1/ContextDiagramCard.tsx` | Thành phần legacy không nằm trong luồng import trực tiếp của App/current GiaiDoan; được chuyển cùng nhóm phụ thuộc nội bộ để bảo toàn mã và có thể khôi phục. |
| `frontend/src/components/step1/RequirementsBoard.tsx` | `_cho_xoa/frontend/src/components/step1/RequirementsBoard.tsx` | Thành phần legacy không nằm trong luồng import trực tiếp của App/current GiaiDoan; được chuyển cùng nhóm phụ thuộc nội bộ để bảo toàn mã và có thể khôi phục. |
| `frontend/src/components/step1/ValidationCard.tsx` | `_cho_xoa/frontend/src/components/step1/ValidationCard.tsx` | Thành phần legacy không nằm trong luồng import trực tiếp của App/current GiaiDoan; được chuyển cùng nhóm phụ thuộc nội bộ để bảo toàn mã và có thể khôi phục. |
| `frontend/src/components/step1/logic.ts` | `_cho_xoa/frontend/src/components/step1/logic.ts` | Thành phần legacy không nằm trong luồng import trực tiếp của App/current GiaiDoan; được chuyển cùng nhóm phụ thuộc nội bộ để bảo toàn mã và có thể khôi phục. |

## Giữ nguyên có chủ đích

- `frontend/src/components/step1/RequirementFormFields.tsx` và `frontend/src/components/step1/types.ts`: đang được luồng hiện hành `Step1NhapYeuCau.tsx` sử dụng.
- `frontend/src/components/step2/Buoc2PhanTichYeuCau.tsx` và `frontend/src/components/step4/Buoc4DacTa.tsx`: chưa đủ bằng chứng để khẳng định không còn phụ thuộc; không di chuyển.
- `backend/services/__init__.py`, `frontend/pnpm-lock.yaml`, `frontend/preview.html`, `frontend/src/preview.tsx`: giữ nguyên do có thể ảnh hưởng package/tooling hoặc chưa xác minh entrypoint.
- Các thư mục được bảo vệ `.git`, `.github`, `.claude`, `.vscode`, `backend/migrations`, `backend/tests`, `frontend/src/components/features` không bị thay đổi.

## Khôi phục

Dùng Git để revert commit này, hoặc chuyển các tệp từ `_cho_xoa/<đường dẫn cũ>` về đường dẫn cũ. Không có tệp nào bị xóa vĩnh viễn.


## Đợt rà soát theo luồng import từ Main / App / HomePage / các GiaiDoan

- Căn cứ: import graph của `frontend/src/main.tsx`, `App.tsx`, `HomePage.tsx` và các component giai đoạn; kiểm tra thêm các import trong bộ test hiện có.
- Quy tắc: chỉ lưu trữ các tệp ngoài thư mục được bảo vệ khi không tìm thấy tham chiếu từ luồng ứng dụng hiện hành hoặc test; không xóa vĩnh viễn.
- Các tệp đã chuyển vào `_cho_xoa/` trong đợt này:

| Đường dẫn cũ | Đường dẫn lưu trữ | Lý do |
|---|---|---|
| `frontend/src/stages/step1_1.ts` | `_cho_xoa/frontend/src/stages/step1_1.ts` | Định nghĩa bước trùng lặp; `stages/index.ts` khai báo cấu hình bước đang được App và các Stepper sử dụng; không thấy import tệp riêng này. |
| `frontend/src/stages/step1_2.ts` | `_cho_xoa/frontend/src/stages/step1_2.ts` | Định nghĩa bước trùng lặp; không thấy import tệp riêng này. |
| `frontend/src/stages/step1_3.ts` | `_cho_xoa/frontend/src/stages/step1_3.ts` | Định nghĩa bước trùng lặp; không thấy import tệp riêng này. |
| `frontend/src/stages/step1_4.ts` | `_cho_xoa/frontend/src/stages/step1_4.ts` | Định nghĩa bước trùng lặp; không thấy import tệp riêng này. |
| `frontend/src/stages/step1_5.ts` | `_cho_xoa/frontend/src/stages/step1_5.ts` | Định nghĩa bước trùng lặp; không thấy import tệp riêng này. |
| `frontend/src/components/step2/Buoc2PhanTichYeuCau.tsx` | `_cho_xoa/frontend/src/components/step2/Buoc2PhanTichYeuCau.tsx` | Component cũ không được tham chiếu bởi luồng Main/App/feature hiện tại hoặc test đã rà soát. |
| `frontend/src/components/step4/Buoc4DacTa.tsx` | `_cho_xoa/frontend/src/components/step4/Buoc4DacTa.tsx` | Component cũ không được tham chiếu bởi luồng Main/App/feature hiện tại hoặc test đã rà soát. |

## Tệp giữ nguyên sau khi rà soát

- `frontend/src/stages/index.ts`: đang được `App.tsx`, `Stepper.tsx` và `GiaiDoanStepper.tsx` sử dụng.
- `frontend/src/components/step1/RequirementFormFields.tsx` và `frontend/src/components/step1/types.ts`: được `Step1NhapYeuCau.tsx` sử dụng; giữ nguyên để không phải sửa thư mục được bảo vệ.
- `frontend/src/components/SpecificationDocument.tsx`: được `SpecificationDocument.test.tsx` sử dụng; giữ lại.
- Không chỉnh sửa hay di chuyển tệp trong `frontend/src/components/features` vì đây là thư mục được bảo vệ.
- Kiểm thử build/test chưa được chạy trong môi trường này; cần để CI hoặc môi trường local xác nhận sau khi đồng bộ nhánh.
