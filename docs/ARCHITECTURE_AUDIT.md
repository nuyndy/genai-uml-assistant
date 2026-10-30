# Architecture Audit — nhánh `ba-centric`

> Phạm vi: kiểm tra cấu trúc mã nguồn tại commit `f2ca4a32`. Đây là bản đánh giá tĩnh; chưa chạy build, test hoặc kiểm thử runtime. Không thay đổi logic sản phẩm trong commit này.

## 1. Kết luận

Có thể tiếp tục phát triển trên repository hiện tại. Chưa có căn cứ để viết lại toàn bộ hệ thống. Nên tái cấu trúc theo từng miền nghiệp vụ, giữ lại các phần đang có giá trị và thay thế dần các phần ghép trách nhiệm quá lớn.

Ưu tiên trước mắt là tách ranh giới nghiệp vụ và luồng phụ thuộc; chưa chỉnh giao diện hay quy trình BA–AI ở bước audit.

## 2. Hiện trạng đã xác nhận

| Khu vực | Hiện trạng | Nhận định |
|---|---|---|
| Frontend — App | `App.tsx` 279 dòng, quản lý đăng nhập, dự án, giai đoạn và workflow | Nhiều trách nhiệm điều phối trong một entry component |
| Frontend — GĐ1 | `GiaiDoan1.tsx` 1.051 dòng, vừa tải/lưu dữ liệu, gọi AI/API, chuyển bước và quản lý trạng thái | Cần tách orchestration, hooks và nghiệp vụ từng bước |
| Frontend — GĐ2 | `GiaiDoan2.tsx` 842 dòng, quản lý dữ liệu UML, hydrate state, điều phối sinh và lưu biểu đồ | Cần tách state/data orchestration khỏi UI |
| Frontend — GĐ3 | `GiaiDoan3.tsx` 392 dòng; import trực tiếp `GiaiDoan1` để dùng lại màn hình SRS | Phụ thuộc chéo giữa các giai đoạn; nên đưa SRS thành feature dùng chung độc lập |
| Frontend services | `requirementService.ts` 453 dòng; `umlService.ts` 553 dòng | API, kiểu dữ liệu và nhiều nhóm thao tác đang tập trung |
| Backend — UML | `routers/uml.py` 3.028 dòng | Router đang ôm nhiều nhóm nghiệp vụ; cần chia module theo use case |
| Backend — Requirements | `routers/requirement.py` 811 dòng | Trộn thao tác yêu cầu, phân tích và User Story |
| Backend — SRS | `routers/srs.py` 939 dòng | Trộn truy vấn, tổng hợp Markdown, AI và export |
| Backend — DB | `main.py` gọi `create_all` và chạy ALTER/DROP index khi khởi động | Thay đổi schema đang gắn với startup; rủi ro triển khai |
| Backend — Models | `database/models.py` 436 dòng | Nhiều entity tập trung trong một module |
| Backend — phụ thuộc | `uml.py` và `specification.py` import helper từ `requirement.py`; `srs.py` import helper từ router khác | Router phụ thuộc router; cần chuyển logic dùng chung sang service/dependency |
| Migration | Có các SQL migration 001–006; README hướng dẫn chạy thủ công | Có lịch sử migration nhưng chưa thấy công cụ quản lý phiên bản migration tự động |
| Kiểm thử | Có backend tests, frontend tests và CI riêng | Có nền tảng regression cần giữ và mở rộng |

## 3. Phần nên giữ

- Các model nghiệp vụ và dữ liệu dự án hiện có; chỉ thay đổi schema khi có migration tương ứng.
- API/service đang được test và có thể tái sử dụng sau khi xác định lại ranh giới.
- Các thành phần UI theo từng bước, editor PlantUML, cơ chế render và các kiểm thử workflow.
- Bộ test backend/frontend và dữ liệu đánh giá chất lượng AI.
- Cơ chế xác thực, phân quyền sở hữu dự án và baseline/traceability; cần bảo toàn hành vi qua test.

## 4. Vấn đề cần xử lý

1. **Ranh giới nghiệp vụ:** Requirements, User Story, Specification, UML và SRS đang giao thoa.
2. **Router quá lớn:** tách endpoint theo nhóm nghiệp vụ; đưa truy vấn và quy tắc nghiệp vụ ra khỏi router.
3. **Phụ thuộc vòng/chéo theo tầng:** router không gọi helper nội bộ của router khác.
4. **Điều phối frontend:** component giai đoạn không nên vừa giữ toàn bộ state, gọi API, xử lý AI và render UI.
5. **SRS dùng chung:** không tái sử dụng nguyên component GĐ1 từ GĐ3; tách màn hình/tính năng SRS độc lập.
6. **Database startup:** không thực hiện ALTER/DROP schema khi import ứng dụng hoặc khởi động server.
7. **CI branch:** workflow hiện liệt kê `main`, `luong_moi` và một số nhánh sửa lỗi, chưa bao gồm `ba-centric`; PR trigger cũng chưa nhận PR vào `ba-centric`.

## 5. Cấu trúc đích đề xuất

### Backend

```text
backend/
  api/
    routers/              # HTTP endpoints, validation boundary
    dependencies/         # auth, ownership, database dependencies
  domain/
    requirements/         # requirement, user story, FR/NFR rules
    uml/                  # actor, use case, diagrams, consistency
    srs/                  # SRS composition and export
    baseline/             # baseline and traceability
  schemas/                # request/response DTOs
  database/
    models/               # SQLAlchemy entities, grouped by domain
    repositories/         # persistence queries
    migrations/           # versioned schema changes
  integrations/
    ai/                   # prompts, model client, structured output
    plantuml/             # render and parser
  tests/
```

### Frontend

```text
frontend/src/
  app/                    # app shell, routing, providers
  features/
    requirements/         # input, analysis, user stories, FR/NFR
    uml/                  # actors, use cases, scenarios, diagrams
    srs/                  # SRS editor, preview, export
    consistency/          # cross-stage checks and review
    baseline/             # approval and versioning
  shared/
    api/                  # HTTP client
    components/           # reusable UI
    hooks/
    types/
    utils/
```

Đây là cấu trúc đích logic; khi triển khai sẽ di chuyển từng phần có kiểm soát, không đổi tên/xóa hàng loạt chỉ để khớp cây thư mục.

## 6. Thứ tự triển khai

| Thứ tự | Công việc | Điều kiện hoàn tất |
|---|---|---|
| 1 | Chốt domain model và luồng BA–AI mới | Có sơ đồ miền, luồng dữ liệu và quy tắc sở hữu dữ liệu rõ ràng |
| 2 | Chuẩn hóa backend foundation: config, DB session, migrations, dependencies | Startup không tự sửa schema; migration chạy có kiểm soát |
| 3 | Tách backend theo domain/service/repository | Router mỏng; không import chéo router; API hiện hữu được regression test |
| 4 | Chuẩn hóa frontend foundation và API layer | Kiểu dữ liệu/API tập trung; state không bị chia sẻ ngầm |
| 5 | Tách feature UI theo Requirements, UML, SRS, Consistency, Baseline | Component nhỏ, một trách nhiệm; SRS không phụ thuộc GĐ1 |
| 6 | Triển khai lại quy trình BA làm chủ, AI hỗ trợ theo yêu cầu | BA nhập/sửa/duyệt; AI không tự quyết định hoặc tự sinh khi chưa được yêu cầu |
| 7 | Regression, đánh giá AI và dọn mã cũ | Build, lint, test và kiểm thử luồng chính đạt |

## 7. Quy tắc thực hiện

- Mỗi thay đổi theo một phạm vi nhỏ, có test trước/sau.
- Không xóa API, bảng hoặc dữ liệu cũ trước khi xác nhận không còn consumer.
- Không đổi schema nếu chưa có migration và phương án dữ liệu cũ.
- Không thêm abstraction nếu chưa có nhu cầu thực tế.
- Giữ tương thích API trong giai đoạn chuyển tiếp; nếu cần breaking change phải cập nhật đồng bộ frontend, backend và test.
- Sau mỗi chặng: chạy kiểm tra phù hợp, ghi nhận kết quả và commit riêng.

## 8. Kiểm tra tự động hiện có

- Backend CI: Python 3.12, cài `backend/requirements.txt`, chạy `python -m pytest`.
- Frontend CI: Node 22, `npm ci`, `npm run build`, `npm test`.
- Các workflow hiện chưa kích hoạt trên nhánh `ba-centric`; cần cập nhật cấu hình CI trước khi dựa vào CI để xác nhận nhánh này.

## 9. Giới hạn của audit

Đã kiểm tra cấu trúc repository, các component điều phối chính, router/backend foundation, migration README, package scripts, CI và danh sách test. Chưa chạy ứng dụng, chưa thực thi test/build, chưa kiểm tra toàn bộ từng hàm và chưa xác nhận mọi quan hệ phụ thuộc bằng công cụ phân tích tĩnh. Các đề xuất tái cấu trúc ở trên là hướng triển khai, không phải kết luận rằng mọi module hiện tại đều cần viết lại.
