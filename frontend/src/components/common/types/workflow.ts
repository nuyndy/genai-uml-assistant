/**
 * Kiểu dữ liệu dùng chung cho toàn bộ luồng 3 GIAI ĐOẠN.
 *
 * Dữ liệu nghiệp vụ được tải/lưu qua API; trạng thái UI được giữ trong một
 * object `WorkflowState` tại App.tsx. Riêng cờ xác nhận UML được lưu cục bộ
 * theo project để khôi phục khi tải lại trang, không thay thế trạng thái nghiệp vụ
 * trong database.
 */

/* ------------------------------------------------------------------ */
/* GIAI ĐOẠN 1 — Thu thập yêu cầu & đặc tả                             */
/* ------------------------------------------------------------------ */

/** Yêu cầu thô theo User Story: vai trò / hành động / mục đích. */
export interface RawRequirement {
  actor: string;
  action: string;
  targetObject: string;
  purpose: string;
  preConditions: string[];
  businessRules: string[];
}

/** Kết quả phân tích ở Bước 2 — tách thành 2 cột đủ / thiếu. */
export interface AnalysisResult {
  /** Thành phần đã đủ (hiển thị ✓ xanh). */
  complete: string[];
  /** Thành phần còn thiếu (hiển thị ⚠ vàng) kèm gợi ý bổ sung. */
  missing: { element: string; suggestion: string }[];
  isComplete?: boolean;
  feedback?: string;
}

/** Loại đặc tả: chức năng / phi chức năng (dùng cho badge màu ở Bước 5). */
export type SpecType = "functional" | "non_functional";

/**
 * Một đặc tả đã sinh. `approved` quyết định đặc tả có xuất hiện ở
 * tài liệu tổng hợp (Bước 5) hay không.
 */
export interface SpecDoc {
  id: number;
  userStoryId?: number;
  feature: string;
  type: SpecType;
  content: string;
  approved: boolean;
  version?: number;
}

/* ------------------------------------------------------------------ */
/* GIAI ĐOẠN 2 — Từ đặc tả đến mô hình hóa UML                        */
/* ------------------------------------------------------------------ */

export interface Actor {
  id: number;
  name: string;
  description?: string;
  role?: string;
  mainBusinesses?: string;
}

export interface Usecase {
  id: number;
  name: string;
  description: string;
  specificationId?: number;
}

/** Kịch bản use case chi tiết — 3 phần có thể sửa. */
export interface Scenario {
  mainFlow: string[];
  altFlows: string[];
  exceptions: string[];
  actor?: string[];
  description?: string[];
  preconditions?: string[];
  minimalGuarantees?: string[];
  postconditions?: string[];
}

/** Loại biểu đồ tương tác được tạo từ kịch bản Use Case. */
export type InteractionType = "sequence" | "collaboration";

/** Một biểu đồ tương tác đã sinh cho một use case. */
export interface InteractionDiagram {
  usecaseId: number;
  type: InteractionType;
  imageUrl: string | null;
  sourceCode?: string;
}

/** Sơ đồ Use Case được lưu riêng cho từng Use Case (nếu có). */
export interface UseCaseDiagram {
  usecaseId: number;
  imageUrl: string | null;
}

/** Biểu đồ hoạt động được lưu cho từng Use Case. */
export interface ActivityDiagram {
  usecaseId: number;
  imageUrl: string | null;
}

/** Lớp miền được cấu hình trước khi sinh biểu đồ lớp ở Giai đoạn 2. */
export interface UmlClass {
  id: number;
  name: string;
  attributes: string[];
  methods: string[];
}

/** Quan hệ giữa các thành phần của biểu đồ (dùng lại ở Giai đoạn 3 Bước 1). */
export interface Relation {
  id: number;
  from: string;
  to: string;
  type: string;
}

/* ------------------------------------------------------------------ */
/* TRUY VẾT, KIỂM TRA NHẤT QUÁN VÀ QUẢN LÝ PHIÊN BẢN                  */
/* ------------------------------------------------------------------ */

/** Các loại sai lệch được phát hiện khi đối chiếu dữ liệu xuyên giai đoạn. */
export type ConsistencyIssueType =
  | "missing_traceability"
  | "missing_scenario"
  | "missing_specification"
  | "diagram_model_mismatch"
  | "interaction_method_mismatch"
  | "terminology_mismatch"
  | "stale_dependency"
  | "syntax_error"
  | "semantic_mismatch"
  | "other";

/** Mức độ ảnh hưởng của một sai lệch. */
export type ConsistencySeverity = "error" | "warning" | "info";

/** Một sai lệch nhất quán được gắn với nguồn và vị trí cần xử lý. */
export interface ConsistencyIssue {
  id: string;
  type: ConsistencyIssueType;
  severity: ConsistencySeverity;
  message: string;
  sourceStage?: 1 | 2 | 3;
  sourceStep?: number;
  entityType?: "requirement" | "user_story" | "specification" | "actor" | "usecase" | "scenario" | "class" | "method" | "diagram" | "srs";
  entityId?: string | number;
  suggestion?: string;
  resolved: boolean;
  resolutionNote?: string;
}

/** Liên kết truy vết giữa hai phần tử trong quy trình. */
export interface TraceabilityLink {
  id: string;
  fromType: "requirement" | "user_story" | "specification" | "actor" | "usecase" | "scenario" | "class" | "method" | "diagram" | "srs";
  fromId: string | number;
  toType: "requirement" | "user_story" | "specification" | "actor" | "usecase" | "scenario" | "class" | "method" | "diagram" | "srs";
  toId: string | number;
  relation: "derived_from" | "realized_by" | "described_by" | "communicates_with" | "documented_in" | "depends_on";
}

/** Trạng thái đồng bộ giữa mô hình nghiệp vụ, mã biểu đồ và ảnh kết xuất. */
export type DiagramSyncStatus = "synced" | "out_of_sync" | "unparseable" | "not_checked";

/** Trạng thái baseline của bộ yêu cầu, mô hình UML và tài liệu SRS. */
export interface WorkflowBaseline {
  id: string;
  version: number;
  createdAt: string;
  approvedAt?: string;
  approved: boolean;
  requirementVersion: number;
  umlVersion: number;
  srsVersion: number;
  unresolvedIssueIds: string[];
  note?: string;
}

/** Ghi nhận một thay đổi làm ảnh hưởng dữ liệu đã xác nhận. */
export interface WorkflowChange {
  id: string;
  changedAt: string;
  stage: 1 | 2 | 3;
  step: number;
  entityType: string;
  entityId: string | number;
  summary: string;
  invalidatedEntityIds: Array<string | number>;
}

/* ------------------------------------------------------------------ */
/* GIAI ĐOẠN 3 — Kiểm tra, cập nhật và hoàn thiện SRS                  */
/* ------------------------------------------------------------------ */

/** Loại file khi xuất biểu đồ ở Bước 4. */
export type ExportFormat = "png" | "svg";

/* ------------------------------------------------------------------ */
/* State chung                                                         */
/* ------------------------------------------------------------------ */

/**
 * Toàn bộ dữ liệu đi xuyên suốt 3 giai đoạn. Khởi tạo một lần tại App.tsx,
 * mỗi lần vào/đổi dự án sẽ reset về `emptyWorkflow()`.
 */
export interface WorkflowState {
  /* Giai đoạn 1 */
  rawRequirement: RawRequirement;
  requirementId: number | null;
  userStoryId: number | null;
  analysis: AnalysisResult | null;
  /** true = đã bấm "Xác nhận yêu cầu đã đầy đủ" ở Bước 3. */
  requirementLocked: boolean;
  specs: SpecDoc[];
  /** Nội dung đặc tả đang được soạn ở Bước 4 (chưa bấm duyệt). */
  draftSpec: { feature: string; type: SpecType; content: string } | null;
  /** Ảnh đã được "chèn" từ Giai đoạn 3 vào tài liệu đặc tả. */
  embeddedDiagrams: { name: string; imageUrl: string }[];

  /* Giai đoạn 2 */
  actors: Actor[];
  usecases: Usecase[];
  /** Scenario theo usecaseId. */
  scenarios: Record<number, Scenario>;
  useCaseDiagramUrl: string | null;
  useCaseDiagramCode: string | null;
  interactions: InteractionDiagram[];
  activityDiagrams: ActivityDiagram[];
  /** Lớp suy luận ở Bước 5 — hiển thị để người dùng xem trước khi sinh ảnh. */
  umlClasses: UmlClass[];
  classDiagramUrl: string | null;
  classDiagramCode: string | null;
  relations: Relation[];

  /* Giai đoạn 3 */

  /** Các sai lệch từ lần kiểm tra nhất quán gần nhất. */
  consistencyIssues: ConsistencyIssue[];
  /** Liên kết truy vết giữa yêu cầu, Use Case, kịch bản, lớp, biểu đồ và SRS. */
  traceabilityLinks: TraceabilityLink[];
  /** Trạng thái đồng bộ của các nguồn biểu đồ; không đồng nghĩa với việc ảnh đã render. */
  diagramSync: {
    useCase: DiagramSyncStatus;
    class: DiagramSyncStatus;
    interactions: Record<number, DiagramSyncStatus>;
  };
  /** Phiên bản dữ liệu đang chỉnh sửa và baseline đã được duyệt gần nhất. */
  workflowVersion: number;
  approvedBaseline: WorkflowBaseline | null;
  /** Lịch sử thay đổi trong phiên làm việc hiện tại. */
  changeHistory: WorkflowChange[];

  /* Trạng thái xác nhận nghiệp vụ */
  actorsUseCasesConfirmed: boolean;
  useCaseDiagramConfirmed: boolean;
  scenariosConfirmed: boolean;
  interactionsConfirmed: boolean;
  classDiagramConfirmed: boolean;

  /* Giai đoạn 3: đồng bộ SRS và hoàn thiện sản phẩm */
  srsSynced: boolean;
  consistencyChecked: boolean;
  baselineApproved: boolean;

  diagramCode: string;
  previewImageUrl: string | null;
  exportFormat: ExportFormat;

}

export const emptyWorkflow = (): WorkflowState => ({
  rawRequirement: {
    actor: "",
    action: "",
    targetObject: "",
    purpose: "",
    preConditions: [],
    businessRules: [],
  },
  requirementId: null,
  userStoryId: null,
  analysis: null,
  requirementLocked: false,
  specs: [],
  draftSpec: null,
  embeddedDiagrams: [],

  actors: [],
  usecases: [],
  scenarios: {},
  useCaseDiagramUrl: null,
  useCaseDiagramCode: null,
  interactions: [],
  activityDiagrams: [],
  umlClasses: [],
  classDiagramUrl: null,
  classDiagramCode: null,
  relations: [],

  actorsUseCasesConfirmed: false,
  useCaseDiagramConfirmed: false,
  scenariosConfirmed: false,
  interactionsConfirmed: false,
  classDiagramConfirmed: false,

  consistencyIssues: [],
  traceabilityLinks: [],
  diagramSync: {
    useCase: "not_checked",
    class: "not_checked",
    interactions: {},
  },
  workflowVersion: 1,
  approvedBaseline: null,
  changeHistory: [],

  srsSynced: false,
  consistencyChecked: false,
  baselineApproved: false,

  diagramCode: "@startuml\n@enduml",
  previewImageUrl: null,
  exportFormat: "png",
});
