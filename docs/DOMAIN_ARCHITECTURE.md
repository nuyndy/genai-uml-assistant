# Domain Architecture & Workflow — BA-centric

> Bước 2. Chốt ranh giới nghiệp vụ và luồng dữ liệu mục tiêu trước khi sửa code. Căn cứ: Luồng-hệ-thống.txt, phản hồi BA-first đã thống nhất và đối chiếu tĩnh model/API hiện tại.

## 1. Nguyên tắc
- BA là người quyết định nội dung. AI chỉ phân tích, gợi ý, rà soát hoặc thực hiện khi BA chủ động yêu cầu.
- Dữ liệu nghiệp vụ có cấu trúc là nguồn chuẩn. PlantUML và ảnh là đầu ra được sinh từ mô hình.
- Nội dung có trạng thái nháp/đề xuất/chờ duyệt/đã duyệt; AI không tự approve hoặc ghi đè nội dung đã duyệt.
- Thay đổi không tự lan truyền. Hệ thống đánh dấu phần phụ thuộc cần rà soát; BA quyết định xử lý.
- Duyệt tạo phiên bản/baseline mới. Khôi phục tạo trạng thái mới, không xóa lịch sử.
- Giữ dữ liệu hiện tại; schema chỉ đổi khi có mapping và migration.

## 2. Luồng nghiệp vụ mục tiêu

### Giai đoạn 1 — Phân tích yêu cầu
BA nhập mô tả → AI phân tích/hỏi làm rõ khi BA yêu cầu → BA bổ sung phạm vi, ràng buộc, thuật ngữ → BA tạo/chỉnh FR và NFR → BA tạo/chỉnh User Story và tiêu chí chấp nhận → BA rà soát, duyệt → chốt bộ yêu cầu.

Không tự sinh hàng loạt User Story, FR hoặc NFR khi BA chưa yêu cầu. Kết quả AI là đề xuất/nháp để BA chỉnh sửa và duyệt.

Đầu ra: mô tả gốc, FR, NFR, User Story, tiêu chí chấp nhận, phạm vi, ràng buộc và thuật ngữ; mỗi phần tử có định danh ổn định.

### Giai đoạn 2 — Phân tích và mô hình hóa UML
BA xác định Actor, Use Case và quan hệ → BA xây dựng kịch bản chính/thay thế/ngoại lệ → BA xây dựng Domain/Class Model → Sequence Diagram và sơ đồ cần thiết → Xác nhận 1: duyệt Actor, Use Case, quan hệ, kịch bản → Xác nhận 2: duyệt bộ UML → tạo phiên bản được duyệt.

AI chỉ hỗ trợ khi được gọi: đề xuất Actor/Use Case, sinh nháp kịch bản, gợi ý lớp/phương thức, viết hoặc sửa PlantUML bằng tiếng Việt. BA được sửa trực tiếp mô hình và mã.

Đầu ra: bộ UML đã duyệt, có truy vết về yêu cầu nguồn.

### Giai đoạn 3 — SRS, đồng bộ và hoàn thiện
Tạo nháp SRS từ baseline đầu vào → BA chỉnh sửa/xác nhận → BA chỉnh UML/PlantUML/canvas hoặc yêu cầu AI hỗ trợ → hiển thị diff → kiểm tra nhất quán/truy vết → BA xử lý từng điểm lệch (sửa SRS, sửa UML hoặc bỏ qua có lý do) → lặp kiểm tra → xác nhận baseline cuối → xuất SRS và sơ đồ.

Nếu Giai đoạn 3 sửa UML đã duyệt: tạo phiên bản mới, đánh dấu SRS và phần phụ thuộc cần rà soát, chạy kiểm tra, yêu cầu xác nhận lại phần mô hình bị ảnh hưởng trước baseline mới.

## 3. Miền nghiệp vụ
| Miền | Dữ liệu/chức năng sở hữu |
|---|---|
| Project & Access | Dự án, người sở hữu, quyền truy cập |
| Requirements | Mô tả gốc, FR, NFR, phạm vi, ràng buộc |
| User Stories | User Story, Acceptance Criteria |
| UML Model | Actor, Use Case, quan hệ, kịch bản, Class/Relation |
| Diagram | PlantUML, ảnh render, trạng thái đồng bộ, lịch sử sơ đồ |
| SRS | Tài liệu SRS và các mục nội dung |
| Traceability | Trace links, glossary/alias |
| Consistency | Quy tắc, điểm lệch, quyết định xử lý |
| Version & Baseline | Revision, approval, snapshot, restore, release |

## 4. Quan hệ dữ liệu mục tiêu
```text
Project
 ├── Requirements
 │    ├── FR
 │    ├── NFR
 │    └── User Stories ── Acceptance Criteria
 ├── UML Model
 │    ├── Actor
 │    ├── Use Case ── Scenarios
 │    ├── Domain / Class Model
 │    └── Diagrams
 ├── SRS Document ── SRS Sections
 ├── Glossary
 ├── Trace Links
 ├── Revisions
 └── Baselines
```

Trace links là quan hệ độc lập, hỗ trợ nhiều-nhiều; mỗi liên kết có loại quan hệ, lý do và trạng thái kiểm tra.

## 5. Quy tắc FR, NFR, User Story
- FR mô tả hành vi/dịch vụ hệ thống phải cung cấp; BA nhập hoặc xác nhận; có ID, nội dung, nguồn, trạng thái và liên kết tới US/UC.
- NFR mô tả thuộc tính chất lượng hoặc ràng buộc; BA nhập hoặc xác nhận; có nhóm, nội dung, điều kiện đo/kiểm chứng nếu xác định được và phạm vi áp dụng.
- User Story mô tả nhu cầu theo vai trò, mục tiêu, lợi ích; có tiêu chí chấp nhận. Một US có thể liên quan nhiều FR và ngược lại.
- Có liên kết không đồng nghĩa đã bao phủ đầy đủ. Coverage phải dựa trên liên kết và quy tắc kiểm tra.
- NFR có thể áp dụng ở cấp dự án, hệ thống, Use Case hoặc thành phần; không ép gắn với một US.

## 6. Định danh, trạng thái, phiên bản
- Database hiện dùng integer primary key; đây là khóa kỹ thuật. Backend đã có bước đầu tạo public key có namespace từ PK (`REQ-000001`, `FR-000001`, `NFR-000001`, `US-000001`, `ACT-000001`, `UC-000001`, `CLS-000001`...).
- Public key hiện được tính từ PK, chưa lưu thành cột riêng. Vì vậy key ổn định trong vòng đời bản ghi trên cùng database, nhưng chưa bảo đảm giữ nguyên khi migrate/import dữ liệu sang database khác. Không gọi đây là global ID.
- Baseline snapshot và trace-link serialization đã bổ sung entity key, đồng thời vẫn giữ integer IDs để tương thích API cũ.
- Không tái sử dụng PK; ID hiển thị không phụ thuộc thứ tự truy vấn.
- Trạng thái nghiệp vụ mục tiêu: draft, proposed, in_review, approved, needs_review, rejected. Không thêm đồng loạt cột trạng thái trước khi có migration và mapping.
- Baseline bất biến tối thiểu chứa yêu cầu, UML, SRS, trace links, glossary, điểm lệch được chấp nhận, người duyệt, thời điểm và phiên bản.
- Bản nháp không được xuất thành tài liệu chính thức.

## 7. Quy tắc kiểm tra nhất quán v1
| Mã | Quy tắc |
|---|---|
| CON-001 | Mỗi yêu cầu có ít nhất một Use Case liên quan hoặc có lý do ngoại lệ. |
| CON-002 | Mỗi Use Case có kịch bản và mục SRS tương ứng. |
| CON-003 | Thông điệp Sequence tham chiếu được đến phương thức phù hợp trong Class Model. |
| CON-004 | Tên Actor và thuật ngữ thống nhất với glossary và alias. |
| CON-005 | Trace link không trỏ đến phần tử không tồn tại. |
| CON-006 | Sơ đồ đánh dấu đồng bộ khớp mã PlantUML và mô hình đã lưu. |
| CON-007 | Baseline ghi nhận điểm lệch còn tồn tại và lý do chấp nhận. |
| CON-008 | Mỗi FR/User Story có ít nhất một tiêu chí chấp nhận. |

Quy tắc xác định được bằng dữ liệu triển khai bằng code. AI chỉ hỗ trợ sai lệch ngữ nghĩa; phải có giải thích và chờ BA quyết định.

## 8. Đối chiếu model/API hiện tại
| Thành phần hiện có | Hiện trạng quan sát được | Hướng xử lý |
|---|---|---|
| raw_requirement | Mô tả yêu cầu, đồng thời chứa một số trường actor/action/object/purpose và trường US | Tách khái niệm yêu cầu gốc khỏi FR/NFR/US; giữ dữ liệu và mapping |
| user_story | Story gắn với một raw requirement | Bổ sung stable key, trạng thái và truy vết |
| specification | Functional gắn User Story; NFR có thể gắn project | Làm rõ FR/NFR thành domain rõ ràng; chưa đổi schema |
| specification_approval | Approval đặc tả | Tái sử dụng nền tảng, thống nhất duyệt xuyên miền |
| actor/use_case/uc_actor_relation | Actor, UC, quan hệ | Giữ dữ liệu, bổ sung stable key/truy vết |
| class_entity/class_relation | Class và quan hệ | Giữ dữ liệu, bổ sung stable key/truy vết |
| diagram/diagram_revision | PlantUML, ảnh và lịch sử sơ đồ | Chuẩn hóa trạng thái parse/render/sync |
| srs_document | Metadata/nội dung một số phần SRS | Tách cấu trúc SRS section khi xác định đủ mapping |
| trace_link/glossary_term | Truy vết và thuật ngữ | Tái sử dụng, chuẩn hóa loại entity và validation |
| entity_revision/project_baseline | Revision và snapshot baseline | Rà soát độ đầy đủ snapshot/restore |
| functional_consolidation_checkpoint | Tiến trình AI tổng hợp FR theo lô | Không dùng làm luồng mặc định; chỉ giữ chuyển tiếp khi còn consumer |

### Khoảng trống xác nhận được
- Phần lớn entity vẫn dùng integer PK; backend mới có public key suy ra từ PK và chưa persist riêng. Cần quyết định chiến lược giữ key khi import/migrate database trước khi coi đây là business key lâu dài.
- FR/NFR đang cùng dùng bảng Specification; functional gắn User Story, NFR có thể gắn Project. Chưa phản ánh rõ quan hệ nhiều-nhiều FR–US–UC.
- Approval hiện có riêng cho Specification; chưa có workflow duyệt thống nhất cho mọi miền.
- Có TraceLink, EntityRevision và ProjectBaseline, nhưng cần kiểm tra sâu snapshot/serializer/restore trước khi kết luận đáp ứng đầy đủ baseline mới.
- Diagram lưu source code và image URL; chưa xác nhận trạng thái đồng bộ model ↔ PlantUML được lưu đầy đủ.

## 9. Quyết định kiến trúc
1. Giữ nguyên database/API trong giai đoạn đầu.
2. Domain service độc lập FastAPI router và SQLAlchemy model.
3. Router chỉ nhận request, gọi use case/service và trả response.
4. Tách AI integration khỏi domain rule; domain service kiểm soát quyền gọi AI.
5. Bổ sung public entity key có namespace song song integer PK; giai đoạn đầu tính deterministic từ PK, giai đoạn sau quyết định persist/migration nếu cần giữ ID xuyên database.
6. Dùng TraceLink cho quan hệ đa miền với registry loại entity hợp lệ.
7. Dùng revision và immutable baseline cho lịch sử.
8. PlantUML/render là projection của mô hình; mã không parse được phải báo chưa đồng bộ.
9. Nội dung AI tạo là đề xuất/nháp; không tự approve hoặc ghi đè nội dung đã duyệt.

## 10. Các bước kế tiếp
1. Bước 3: chuẩn hóa backend foundation — config, DB session, migrations, dependencies; chưa đổi nghiệp vụ.
2. Bước 4: tách backend domain/service/repository, bắt đầu Requirements và Specifications.
3. Bước 5: chuẩn hóa frontend API/state và tách feature.
4. Bước 6: triển khai BA-first theo từng giai đoạn.
5. Bước 7: baseline, traceability, consistency và SRS/UML sync.
6. Bước 8: regression toàn luồng, đánh giá AI và dọn mã cũ.

## 11. Nội dung nguồn chưa quy định
Chưa có quy định chi tiết về trường bắt buộc và cách đánh mã FR/NFR/US; quy tắc phân rã yêu cầu; danh mục/đo kiểm NFR; ma trận truy vết bắt buộc; phạm vi chính xác của từng baseline và vai trò duyệt. Không tự đặt các quy tắc này khi tái cấu trúc nền tảng; cần chốt trước khi triển khai schema/validation tương ứng.

## 12. Cập nhật triển khai Giai đoạn 3 (2026-10-30)

- Thứ tự giao diện Giai đoạn 3: rà soát/đồng bộ SRS → chỉnh sửa UML → kiểm tra nhất quán → xử lý sai lệch và duyệt baseline.
- Khi mã UML được sửa hoặc lưu lại, kết quả kiểm tra trước đó bị vô hiệu hóa; phải chạy kiểm tra mới trước khi tạo baseline.
- Sai lệch trong baseline nháp có thể được BA đánh dấu open, accepted hoặc waived. Accepted/waived bắt buộc có acceptance_reason; cập nhật quyết định không sửa snapshot.
- Baseline đã duyệt không cho sửa quyết định sai lệch. Backend kiểm tra snapshot có còn khớp dữ liệu dự án trước khi duyệt.
- Xuất SRS DOCX chính thức yêu cầu baseline đã duyệt; giao diện truyền đúng baseline_id để xuất đúng snapshot, không lấy dữ liệu nháp hiện tại.
- Đây là trạng thái triển khai hiện tại, không thay thế các quy tắc domain ở trên. CI frontend vẫn còn các kiểm thử cũ cần được phân loại/cập nhật; không coi test suite frontend đã xanh.
