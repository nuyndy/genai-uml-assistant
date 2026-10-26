# Nhật ký thay đổi — nhánh `luong_moi`

## Tái cấu trúc `utils`, `types`, `stages` vào `components/common`

- Thời điểm: 2026-10-26
- Phạm vi: chỉ thay đổi vị trí các module dùng chung và cập nhật import; không thay đổi logic nghiệp vụ.
- Chuyển `frontend/src/utils/imageExtension.ts` thành `frontend/src/components/common/utils/imageExtension.ts`.
- Chuyển `frontend/src/types/workflow.ts` thành `frontend/src/components/common/types/workflow.ts`.
- Chuyển `frontend/src/stages/index.ts` thành `frontend/src/components/common/stages.ts` vì chỉ có một file cấu hình giai đoạn.
- Cập nhật các import liên quan trong App, preview, component giai đoạn, Stepper, service UML và test.
- Không xóa vĩnh viễn nội dung; các tệp được chuyển bằng Git tree để giữ nguyên blob lịch sử.
- Build/test chưa được chạy trong môi trường chỉnh sửa; cần xác nhận bằng CI hoặc chạy `npm test` và `npm run build` trong `frontend/`.
