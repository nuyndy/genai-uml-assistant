import { apiFetch } from "./api";
import type { InteractionType, Scenario } from "../types/workflow";
import type { SpecType } from "../types/workflow";

export interface SpecificationForUml {
  id: number;
  user_story_id: number;
  type: SpecType;
  content: string;
  version: number;
  user_story: {
    id: number;
    role: string | null;
    feature: string;
    benefit: string | null;
  };
}

export interface ActorRecord {
  id: number;
  project_id: number;
  name: string;
  description?: string | null;
  role?: string | null;
  main_businesses?: string | null;
}

/**
 * Use case do backend trả về — xem `backend/schemas/uml.py` (`class UseCaseRecord`).
 *
 * LƯU Ý QUAN TRỌNG: backend Python trả kịch bản ở dạng snake_case
 * (`main_flow` / `alt_flow` / `exception_flow`), KHÔNG phải camelCase.
 *
 * Interface này trước đây khai `extends Scenario` (camelCase `mainFlow`...), khiến
 * `useCase.mainFlow` luôn là `undefined` và làm sập màn hình Giai đoạn 2 tại
 * `hydrateState` (GiaiDoan2.tsx). Khai báo đúng snake_case để khớp backend.
 */
export interface UseCaseRecord {
  id: number;
  specification_id: number;
  name: string;
  actor?: string | null;
  description?: string | null;
  preconditions?: string | null;
  minimal_guarantees?: string | null;
  postconditions?: string | null;
  main_flow: string[];
  alt_flow: string[];
  exception_flow: string[];
}

/**
 * Đặc tả của project — xem `backend/schemas/specification.py`.
 * Giai đoạn 2 tự nạp danh sách này để biết đã hoàn thành Giai đoạn 1 hay chưa.
 */
export interface ProjectSpecificationRecord {
  id: number;
  user_story_id: number | null;
  feature: string;
  type: "functional" | "non_functional";
  content: string;
  version: number;
}

export interface ActorRelationRecord {
  id: number;
  use_case_id: number;
  actor_id: number;
  relation_type: string;
}

export interface DiagramRecord {
  id: number;
  project_id: number;
  use_case_id: number | null;
  type: "use_case" | "class" | InteractionType;
  source_code: string;
  image_url: string | null;
  version: number;
}

export interface ClassRecord {
  id: number;
  project_id: number;
  name: string;
  attributes: string[];
  methods: string[];
}

export interface ClassRelationRecord {
  id: number;
  class_a_id: number;
  class_b_id: number;
  relation_type: string;
}

export interface ProjectUmlState {
  actors: ActorRecord[];
  use_cases: UseCaseRecord[];
  relations: ActorRelationRecord[];
  diagrams: DiagramRecord[];
  classes: ClassRecord[];
  class_relations: ClassRelationRecord[];
}

export interface ExtractedSuggestions {
  suggested_actors: { name: string }[];
  suggested_use_cases: {
    name: string;
    description: string;
    specification_id: number;
  }[];
}

export interface SaveActorUseCasesBatchPayload {
  actors: { name: string }[];
  use_cases: { specification_id: number; name: string }[];
  relations: {
    specification_id: number;
    use_case_name: string;
    actor_name: string;
    relation_type: string;
  }[];
}

export interface UseCaseScenarioBatchItem {
  use_case_id: number;
  /** Đồng bộ với `UseCaseRecord` — xem `backend/schemas/uml.py`. */
  name: string;
  specification_id: number;
  actor: string[];
  description: string[];
  preconditions: string[];
  minimal_guarantees: string[];
  postconditions: string[];
  main_flow: string[];
  alt_flow: string[];
  exception_flow: string[];
}

export function listSpecificationsForUml(projectId: number) {
  return apiFetch<SpecificationForUml[]>(
    `/api/projects/${projectId}/specifications-with-stories`,
  );
}

/**
 * Danh sách đặc tả của project (cả chức năng lẫn phi chức năng).
 *
 * Giai đoạn 2 gọi endpoint này ngay khi mở để tự xác định đã hoàn thành
 * Giai đoạn 1 hay chưa, thay vì tin vào state cũ được truyền từ Giai đoạn 1
 * (state đó có thể rỗng hoặc đã cũ sau khi reload trang).
 */
export function listProjectSpecificationsForUml(projectId: number) {
  return apiFetch<ProjectSpecificationRecord[]>(
    `/api/projects/${projectId}/specifications`,
  );
}

export function extractActorsUseCases(specificationId: number) {
  return apiFetch<ExtractedSuggestions>(
    `/api/specifications/${specificationId}/extract-actors-usecases`,
    { method: "POST" },
  );
}

export function extractProjectActorsUseCasesBatch(projectId: number) {
  return apiFetch<ExtractedSuggestions>(
    `/api/projects/${projectId}/extract-actors-usecases-batch`,
    { method: "POST" },
  );
}

export function saveProjectActorUseCasesBatch(
  projectId: number,
  payload: SaveActorUseCasesBatchPayload,
) {
  return apiFetch<{
    actors: ActorRecord[];
    use_cases: UseCaseRecord[];
    relations: ActorRelationRecord[];
  }>(`/api/projects/${projectId}/actors-use-cases/batch`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createProjectActor(projectId: number, name: string) {
  return apiFetch<ActorRecord>(`/api/projects/${projectId}/actors`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updateActor(actorId: number, data: { name?: string; description?: string; role?: string; main_businesses?: string }) {
  return apiFetch<ActorRecord>(`/api/actors/${actorId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function listProjectActors(projectId: number) {
  return apiFetch<ActorRecord[]>(`/api/projects/${projectId}/actors`);
}

/**
 * Parse PlantUML source code into UML model for sync.
 */
export function parsePlantUml(projectId: number, sourceCode: string) {
  return apiFetch<any>(`/api/projects/${projectId}/parse-plantuml`, {
    method: "POST",
    body: JSON.stringify({ source_code: sourceCode }),
  });
}

export function deleteActor(actorId: number) {
  return apiFetch<void>(`/api/actors/${actorId}`, { method: "DELETE" });
}

export function createSpecificationUseCase(specificationId: number, name: string) {
  return apiFetch<UseCaseRecord>(
    `/api/specifications/${specificationId}/use-cases`,
    { method: "POST", body: JSON.stringify({ name }) },
  );
}

export function listProjectUseCases(projectId: number) {
  return apiFetch<UseCaseRecord[]>(`/api/projects/${projectId}/use-cases`);
}

export function getUseCase(useCaseId: number) {
  return apiFetch<UseCaseRecord>(`/api/use-cases/${useCaseId}`);
}

export function listUseCaseActorRelations(useCaseId: number) {
  return apiFetch<ActorRelationRecord[]>(`/api/use-cases/${useCaseId}/actor-relations`);
}

export function deleteActorRelation(relationId: number) {
  return apiFetch<void>(`/api/actor-relations/${relationId}`, { method: "DELETE" });
}

export function updateUseCaseName(useCaseId: number, name: string) {
  return apiFetch<UseCaseRecord>(`/api/use-cases/${useCaseId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteUseCase(useCaseId: number) {
  return apiFetch<void>(`/api/use-cases/${useCaseId}`, { method: "DELETE" });
}

export function saveActorRelation(
  useCaseId: number,
  actorId: number,
  relationType: string,
) {
  return apiFetch<ActorRelationRecord>(
    `/api/use-cases/${useCaseId}/actor-relations`,
    {
      method: "POST",
      body: JSON.stringify({ actor_id: actorId, relation_type: relationType }),
    },
  );
}

export function generateUseCaseDiagram(projectId: number) {
  return apiFetch<DiagramRecord>(
    `/api/projects/${projectId}/diagrams/use-case`,
    { method: "POST" },
  );
}

/**
 * Sinh lại biểu đồ use case từ mã PlantUML người dùng đã sửa tay.
 *
 * Backend chỉ sinh mã từ mô hình ở endpoint POST, nên bước "sinh từ mã riêng"
 * gồm hai nhịp: tạo biểu đồ chuẩn trước (để có bản ghi), rồi PATCH đè source_code
 * để render lại ảnh. Cách này tránh thêm endpoint mới mà vẫn dùng đúng luồng render.
 */
export async function regenerateUseCaseDiagramFromCode(
  projectId: number,
  sourceCode: string,
) {
  const created = await generateUseCaseDiagram(projectId);
  return updateDiagram(created.id, sourceCode);
}

export function generateScenario(useCaseId: number) {
  return apiFetch<UseCaseRecord>(
    `/api/use-cases/${useCaseId}/generate-scenario`,
    { method: "POST" },
  );
}

export function generateProjectScenariosBatch(projectId: number) {
  return apiFetch<{ results: UseCaseScenarioBatchItem[] }>(
    `/api/projects/${projectId}/use-cases/generate-scenarios-batch`,
    { method: "POST" },
  );
}

export function updateUseCaseScenario(useCaseId: number, scenario: Scenario) {
  return apiFetch<UseCaseRecord>(`/api/use-cases/${useCaseId}`, {
    method: "PATCH",
    body: JSON.stringify({
      actor: scenario.actor?.join("\n") ?? "",
      description: scenario.description?.join("\n") ?? "",
      preconditions: scenario.preconditions?.join("\n") ?? "",
      minimal_guarantees: scenario.minimalGuarantees?.join("\n") ?? "",
      postconditions: scenario.postconditions?.join("\n") ?? "",
      main_flow: scenario.mainFlow,
      alt_flow: scenario.altFlows,
      exception_flow: scenario.exceptions,
    }),
  });
}

export function generateInteractionDiagram(
  useCaseId: number,
  diagramType: InteractionType,
) {
  return apiFetch<DiagramRecord>(
    `/api/use-cases/${useCaseId}/diagrams`,
    {
      method: "POST",
      body: JSON.stringify({ diagram_type: diagramType }),
    },
  );
}

export function generateProjectInteractionDiagramsBatch(
  projectId: number,
  diagramType: InteractionType,
) {
  return apiFetch<DiagramRecord[]>(
    `/api/projects/${projectId}/use-cases/generate-interaction-diagrams-batch`,
    {
      method: "POST",
      body: JSON.stringify({ diagram_type: diagramType }),
    },
  );
}

export function createProjectClass(
  projectId: number,
  data: Pick<ClassRecord, "name" | "attributes" | "methods">,
) {
  return apiFetch<ClassRecord>(`/api/projects/${projectId}/classes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listProjectClasses(projectId: number) {
  return apiFetch<ClassRecord[]>(`/api/projects/${projectId}/classes`);
}

export function updateClass(
  classId: number,
  data: Partial<Pick<ClassRecord, "name" | "attributes" | "methods">>,
) {
  return apiFetch<ClassRecord>(`/api/classes/${classId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteClass(classId: number) {
  return apiFetch<void>(`/api/classes/${classId}`, { method: "DELETE" });
}

export function createClassRelation(
  classId: number,
  classBId: number,
  relationType: string,
) {
  return apiFetch<ClassRelationRecord>(`/api/classes/${classId}/relations`, {
    method: "POST",
    body: JSON.stringify({ class_b_id: classBId, relation_type: relationType }),
  });
}

export function listProjectClassRelations(projectId: number) {
  return apiFetch<ClassRelationRecord[]>(`/api/projects/${projectId}/class-relations`);
}

export function deleteClassRelation(relationId: number) {
  return apiFetch<void>(`/api/class-relations/${relationId}`, { method: "DELETE" });
}

export function generateClasses(projectId: number) {
  return apiFetch<ClassRecord[]>(
    `/api/projects/${projectId}/generate-classes`,
    { method: "POST" },
  );
}

export function generateClassDiagram(projectId: number) {
  return apiFetch<DiagramRecord>(`/api/projects/${projectId}/diagrams/class`, {
    method: "POST",
  });
}

/**
 * Sinh lại biểu đồ lớp từ mã PlantUML người dùng đã sửa tay.
 *
 * Cùng cách làm với biểu đồ use case: tạo bản ghi biểu đồ chuẩn trước, rồi PATCH
 * source_code để backend render lại ảnh từ đúng mã người dùng nhập.
 */
export async function regenerateClassDiagramFromCode(
  projectId: number,
  sourceCode: string,
) {
  const created = await generateClassDiagram(projectId);
  return updateDiagram(created.id, sourceCode);
}

export function listProjectDiagrams(projectId: number) {
  return apiFetch<DiagramRecord[]>(`/api/projects/${projectId}/diagrams`);
}

export function getDiagram(diagramId: number) {
  return apiFetch<DiagramRecord>(`/api/diagrams/${diagramId}`);
}

export function updateDiagram(diagramId: number, sourceCode: string) {
  return apiFetch<DiagramRecord>(`/api/diagrams/${diagramId}`, {
    method: "PATCH",
    body: JSON.stringify({ source_code: sourceCode }),
  });
}

export function deleteDiagram(diagramId: number) {
  return apiFetch<void>(`/api/diagrams/${diagramId}`, { method: "DELETE" });
}

export function getProjectUmlState(projectId: number) {
  return apiFetch<ProjectUmlState>(`/api/projects/${projectId}/uml-state`);
}

export interface ProjectBaseline {
  id: number;
  version: number;
  name: string;
  status: "draft" | "approved" | string;
  created_at: string | null;
  approved_at: string | null;
  open_issues: unknown[];
}

export interface UmlConsistencyResult {
  project_id: number;
  consistent: boolean;
  missing_in_database: string[];
  missing_in_plantuml: string[];
  missing_relations: Array<{
    from: string;
    to: string;
    type: string;
  }>;
  extra_relations: Array<{
    from: string;
    to: string;
    type: string;
  }>;
}

/** Lấy danh sách baseline của dự án, mới nhất trước. */
export function listProjectBaselines(
  projectId: number,
): Promise<ProjectBaseline[]> {
  return apiFetch<ProjectBaseline[]>(
    `/api/projects/${projectId}/baselines`,
  );
}

/** Tạo baseline bản nháp từ trạng thái dữ liệu hiện tại. */
export function createProjectBaseline(
  projectId: number,
  name: string,
  openIssues: unknown[] = [],
): Promise<ProjectBaseline> {
  return apiFetch<ProjectBaseline>(
    `/api/projects/${projectId}/baselines`,
    {
      method: "POST",
      body: JSON.stringify({
        name,
        open_issues: openIssues,
      }),
    },
  );
}

/** Duyệt baseline; backend sẽ từ chối nếu còn vấn đề chưa xử lý. */
export function approveProjectBaseline(
  projectId: number,
  baselineId: number,
): Promise<{
  id: number;
  version: number;
  status: string;
  approved_at: string | null;
}> {
  return apiFetch(
    `/api/projects/${projectId}/baselines/${baselineId}/approve`,
    { method: "POST" },
  );
}

/** So sánh mã PlantUML biểu đồ lớp với mô hình UML đã lưu. */
export function checkProjectUmlConsistency(
  projectId: number,
  sourceCode: string,
): Promise<UmlConsistencyResult> {
  return apiFetch<UmlConsistencyResult>(
    `/api/projects/${projectId}/check-uml-consistency`,
    {
      method: "POST",
      body: JSON.stringify({ source_code: sourceCode }),
    },
  );
}
