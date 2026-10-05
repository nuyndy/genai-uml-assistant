# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

## Giai đoạn 1: Thu thập yêu cầu và đặc tả

Giai đoạn 1 dùng ID dự án thật từ PostgreSQL, lưu yêu cầu và user story qua
FastAPI, đồng thời gọi Ollama cục bộ cho phân tích và sinh đặc tả. Backend cần
có `DATABASE_URL`; Ollama cần được mở riêng và có model đã tải bằng
`ollama pull qwen2.5:3b`. Có thể đặt `OLLAMA_BASE_URL` (mặc định
`http://localhost:11434`), `OLLAMA_MODEL` (mặc định `qwen2.5:3b`) và
`OLLAMA_TIMEOUT_SECONDS` (mặc định `300`). Các API yêu cầu header Bearer token như luồng
đăng nhập hiện tại.

### API dự án và khôi phục tiến độ

- `GET /api/projects` và `POST /api/projects` đọc/tạo dự án trong bảng `project`.
- `GET /api/projects/{project_id}/requirements` đọc yêu cầu để khôi phục giao
  diện sau khi tải lại trang.
- `GET /api/projects/{id}/specifications` đọc các đặc tả đã lưu của dự án.

### API yêu cầu và đặc tả

- `POST`, `GET /api/projects/{project_id}/requirements` tạo và liệt kê yêu cầu.
- `POST /api/projects/{project_id}/requirements/analyze-batch` phân tích toàn bộ
  yêu cầu bản nháp trong project.
- `POST /api/projects/{project_id}/requirements/user-stories/preview` dùng AI
  tạo bản nháp User Story từ yêu cầu `draft` để người dùng kiểm duyệt; chưa ghi
  các bản nháp này vào database.
- `POST /api/projects/{project_id}/requirements/confirm-batch` xác thực lại và
  xác nhận, lưu các User Story đã được người dùng duyệt và cập nhật trạng
  thái yêu cầu.
- `GET`, `PATCH`, `DELETE /api/requirements/{id}` đọc, sửa và xóa yêu cầu
  (chỉ xóa được yêu cầu `draft` chưa có user story).
- `POST /api/requirements/{id}/analyze` phân tích nội dung đã lưu bằng AI cục bộ.
- `POST /api/requirements/{id}/confirm` xác nhận yêu cầu và tạo user story.
- `GET /api/projects/{project_id}/user-stories` liệt kê user story của dự án.
- `GET`, `PATCH`, `DELETE /api/user-stories/{id}` đọc, sửa và xóa user story.
- `POST`, `GET /api/user-stories/{id}/specifications` sinh và liệt kê đặc tả
  `functional` hoặc `non_functional`.
- `POST /api/projects/{project_id}/user-stories/generate-specs-batch` sinh đặc
  tả chức năng cho tất cả user story chưa có đặc tả chức năng.
- `GET /api/projects/{project_id}/specifications` liệt kê đặc tả của dự án.
- `GET`, `PATCH`, `DELETE /api/specifications/{id}` đọc, sửa và xóa đặc tả
  (không xóa được đặc tả đang được use case tham chiếu).

API xuất tài liệu chưa được triển khai. Bước tổng hợp hiển thị dữ liệu đã lưu;
nút xuất được để ở trạng thái chưa khả dụng thay vì giả lập file.

Luồng Giai đoạn 1 vẫn theo 5 bước tuần tự: nhập nhiều yêu cầu và lưu từng yêu
cầu ở trạng thái `draft`, phân tích toàn bộ bản nháp, dùng AI tạo bản nháp User
Story để người dùng kiểm duyệt và xác nhận, sinh đặc tả chức năng cho các
user story chưa có đặc tả, cuối cùng tổng hợp tài liệu đã lưu.
Đặc tả ở Bước 4 và Bước 5 được trình bày dạng trang tài liệu có định dạng;
người dùng có thể mở chế độ sửa nội dung ở Bước 4.

## Giai đoạn 2: Từ đặc tả đến mô hình hóa UML

Giai đoạn 2 đọc và ghi các tác nhân, use case, quan hệ, kịch bản, lớp và biểu
đồ qua FastAPI/PostgreSQL. Khi mở lại dự án, giao diện tải lại tiến độ từ
`GET /api/projects/{id}/uml-state`. Các chức năng AI ở Giai đoạn 2 dùng chung
Ollama và cấu hình model như Giai đoạn 1.

- `GET /api/projects/{id}/specifications-with-stories` liệt kê đặc tả chưa có use case.
- `POST /api/specifications/{id}/extract-actors-usecases` đề xuất tác nhân và use case.
- `POST /api/projects/{project_id}/extract-actors-usecases-batch` đọc toàn bộ
  đặc tả và trả gợi ý actor/use case đã tổng hợp, không lưu dữ liệu.
- `POST /api/projects/{project_id}/actors-use-cases/batch` lưu các actor, use
  case và quan hệ đã chọn trong một transaction.
- `POST`, `GET /api/projects/{project_id}/actors` tạo và liệt kê tác nhân.
- `PATCH`, `DELETE /api/actors/{id}` sửa và xóa tác nhân.
- `POST /api/specifications/{id}/use-cases` tạo use case.
- `GET /api/projects/{project_id}/use-cases` và
  `GET /api/use-cases/{id}` đọc các use case.
- `PATCH`, `DELETE /api/use-cases/{id}` sửa và xóa use case.
- `POST /api/use-cases/{id}/actor-relations` tạo quan hệ tác nhân và use case.
- `GET /api/use-cases/{id}/actor-relations` và
  `DELETE /api/actor-relations/{id}` đọc, xóa quan hệ.
- `POST /api/projects/{project_id}/diagrams/use-case` sinh biểu đồ tổng quát.
- `POST /api/use-cases/{id}/generate-scenario` và
  `PATCH /api/use-cases/{id}` sinh, cập nhật kịch bản.
- `POST /api/projects/{project_id}/use-cases/generate-scenarios-batch` sinh
  kịch bản cho tất cả use case chưa có luồng chính.
- `POST /api/use-cases/{id}/diagrams` sinh biểu đồ sequence hoặc collaboration.
- `POST /api/projects/{project_id}/use-cases/generate-interaction-diagrams-batch`
  sinh biểu đồ cùng một loại cho các use case đủ kịch bản chưa có biểu đồ đó.
- `POST`, `GET /api/projects/{project_id}/classes` tạo, liệt kê lớp; `PATCH`,
  `DELETE /api/classes/{id}` sửa, xóa lớp.
- `POST /api/projects/{project_id}/generate-classes` suy luận và lưu mô hình lớp.
- `POST /api/classes/{id}/relations`,
  `GET /api/projects/{project_id}/class-relations`, và
  `DELETE /api/class-relations/{id}` quản lý quan hệ giữa lớp.
- `POST /api/projects/{project_id}/diagrams/class` sinh biểu đồ lớp.
- `GET /api/projects/{project_id}/diagrams` và `GET /api/diagrams/{id}` đọc
  biểu đồ; `PATCH`, `DELETE /api/diagrams/{id}` sửa mã, render lại và xóa.

Luồng Giai đoạn 2 vẫn theo 5 bước tuần tự: phân tích tất cả đặc tả và lưu danh
sách actor/use case đã chọn, sinh một biểu đồ use case tổng, sinh kịch bản cho
tất cả use case còn thiếu rồi cho phép sửa riêng từng kịch bản, sinh biểu đồ
tương tác cùng loại cho tất cả use case đủ kịch bản, cuối cùng tổng hợp mô hình
lớp và biểu đồ lớp của toàn project.

Backend cần dịch vụ render PlantUML để tạo ảnh. Dịch vụ này đã có sẵn trong
`backend/render_service.py`, nhận `POST /render` với JSON `{"source_code":"..."}`
và trả `{"image_url":"data:image/svg;base64,..."}`. Nó chuyển tiếp mã PlantUML sang
[Kroki](https://kroki.io) để render, nên **không cần cài Java hay Docker**.

Chạy thêm service này cùng backend:

```bash
cd backend
python -m uvicorn render_service:app --host 127.0.0.1 --port 8080
```

Trỏ `PLANTUML_RENDER_URL=http://localhost:8080` trong `backend/.env`. Đổi đích
render bằng `KROKI_URL`, đổi định dạng ảnh bằng `KROKI_OUTPUT_FORMAT=svg|png`.

Khi dịch vụ render không chạy, API vẫn lưu mã PlantUML vào PostgreSQL và để
`image_url` NULL; người dùng chỉ cần sinh lại biểu đồ sau khi bật service. Bước 3
và Bước 4 của Giai đoạn 2 vẫn dùng được vì sinh kịch bản không phụ thuộc ảnh.

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
