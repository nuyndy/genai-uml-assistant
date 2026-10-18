import { apiFetch, apiFetchBlob } from "./api";

export interface RequirementPayload {
  actor: string;
  action: string;
  target_object: string;
  purpose: string;
  pre_conditions: string[];
  business_rules: string[];
}

export type RequirementUpdatePayload = RequirementPayload;

export interface RequirementCreated {
  id: number;
  status: "draft";
}

export interface RequirementAnalysis {
  is_complete: boolean;
  missing_elements: string[];
  feedback: string;
}

export interface RequirementBatchAnalysisItem extends RequirementAnalysis {
  requirement_id: number;
}

export interface RequirementBatchAnalysis {
  results: RequirementBatchAnalysisItem[];
}

export interface RequirementCoverageSuggestion extends RequirementPayload {
  reason: string;
}

export interface RequirementCoverageAnalysis {
  is_sufficient: boolean;
  summary: string;
  suggestions: RequirementCoverageSuggestion[];
}

export interface UserStory {
  id: number;
  requirement_id?: number;
  role: string | null;
  feature: string;
  benefit: string | null;
  acceptance_criteria: string | null;
}

export interface UserStoryDraft {
  requirement_id: number;
  role: string;
  feature: string;
  benefit: string;
  acceptance_criteria: string;
}

export interface UserStoryDraftBatch {
  results: UserStoryDraft[];
}

export type UserStoryUpdatePayload = Pick<
  UserStory,
  "role" | "feature" | "benefit" | "acceptance_criteria"
>;

export interface RequirementRecord {
  id: number;
  project_id: number;
  content: string;
  status: "draft" | "confirmed";
  user_story: UserStory | null;
}

export interface SpecificationRecord {
  id: number;
  user_story_id: number | null;
  feature: string;
  type: "functional" | "non_functional";
  content: string;
  version: number;
}

export interface FieldMapping {
  field_name: string;
  data_type: string;
  required: boolean;
  validation_rule: string;
}

export interface FunctionalSpecification {
  function_code: string;
  function_name: string;
  description: string;
  actors: string[];
  priority: "Must" | "Should" | "Could" | "Won't";
  pre_conditions: string[];
  main_flow: string[];
  alternative_flows: string[];
  exception_flows: string[];
  post_conditions: string[];
  business_rules: string[];
  field_mapping: FieldMapping[];
}

export interface NonFunctionalSpecification {
  items: { group: string; criteria: string; requirement: string }[];
}

export interface SrsMetadata {
  intro_purpose: string;
  intro_scope: string;
  intro_definitions: string;
  overview_user_classes: string;
  overview_environment: string;
  appendix_notes: string;
}

export interface SpecificationDocument {
  project_id: number;
  metadata: SrsMetadata;
  sections: Record<string, unknown>[];
  raw_markdown: string;
}

export function createRequirement(
  projectId: number,
  payload: RequirementPayload,
): Promise<RequirementCreated> {
  return apiFetch(`/api/projects/${projectId}/requirements`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function checkProjectRequirementCoverage(
  projectId: number,
): Promise<RequirementCoverageAnalysis> {
  return apiFetch(`/api/projects/${projectId}/requirements/coverage-check`, {
    method: "POST",
  });
}

export function createProjectRequirementsBatch(
  projectId: number,
  requirements: RequirementPayload[],
): Promise<RequirementRecord[]> {
  return apiFetch(`/api/projects/${projectId}/requirements/batch`, {
    method: "POST",
    body: JSON.stringify({ requirements }),
  });
}

export function analyzeRequirement(id: number): Promise<RequirementAnalysis> {
  return apiFetch(`/api/requirements/${id}/analyze`, { method: "POST" });
}

export function analyzeProjectRequirementsBatch(
  projectId: number,
): Promise<RequirementBatchAnalysis> {
  return apiFetch(`/api/projects/${projectId}/requirements/analyze-batch`, {
    method: "POST",
  });
}

export function previewProjectUserStories(
  projectId: number,
): Promise<UserStoryDraftBatch> {
  return apiFetch(
    `/api/projects/${projectId}/requirements/user-stories/preview`,
    { method: "POST" },
  );
}

export function getRequirement(id: number): Promise<RequirementRecord> {
  return apiFetch(`/api/requirements/${id}`);
}

export function deleteRequirement(id: number): Promise<void> {
  return apiFetch(`/api/requirements/${id}`, { method: "DELETE" });
}

export function listProjectRequirements(
  projectId: number,
): Promise<RequirementRecord[]> {
  return apiFetch(`/api/projects/${projectId}/requirements`);
}

export function updateRequirement(
  id: number,
  payload: RequirementUpdatePayload,
): Promise<RequirementCreated> {
  return apiFetch(`/api/requirements/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function confirmRequirement(id: number): Promise<UserStory> {
  return apiFetch(`/api/requirements/${id}/confirm`, { method: "POST" });
}

export function confirmProjectRequirementsBatch(
  projectId: number,
  requirementIds: number[],
  userStories: UserStoryDraft[],
): Promise<UserStory[]> {
  return apiFetch(`/api/projects/${projectId}/requirements/confirm-batch`, {
    method: "POST",
    body: JSON.stringify({
      requirement_ids: requirementIds,
      user_stories: userStories,
    }),
  });
}

export function listProjectUserStories(projectId: number): Promise<UserStory[]> {
  return apiFetch(`/api/projects/${projectId}/user-stories`);
}

export function getUserStory(id: number): Promise<UserStory> {
  return apiFetch(`/api/user-stories/${id}`);
}

export function updateUserStory(
  id: number,
  payload: UserStoryUpdatePayload,
): Promise<UserStory> {
  return apiFetch(`/api/user-stories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteUserStory(id: number): Promise<void> {
  return apiFetch(`/api/user-stories/${id}`, { method: "DELETE" });
}

export function generateSpecification(
  userStoryId: number,
  type: SpecificationRecord["type"] = "functional",
  regenerate = false,
): Promise<SpecificationRecord> {
  return apiFetch(`/api/user-stories/${userStoryId}/specifications`, {
    method: "POST",
    body: JSON.stringify({ type, regenerate }),
  });
}

export function generateProjectSpecificationsBatch(
  projectId: number,
): Promise<SpecificationRecord[]> {
  return apiFetch(
    `/api/projects/${projectId}/user-stories/generate-specs-batch`,
    { method: "POST" },
  );
}

export interface SpecificationApprovalResult {
  specification_id: number;
  approval_status: "draft" | "approved";
  approved_at: string | null;
}

export function getSpecificationApproval(
  id: number,
): Promise<SpecificationApprovalResult> {
  return apiFetch(`/api/specifications/${id}/approval`);
}

export function approveSpecification(
  id: number,
): Promise<SpecificationApprovalResult> {
  return apiFetch(`/api/specifications/${id}/approve`, { method: "POST" });
}

export function updateSpecification(
  id: number,
  content: string | FunctionalSpecification | NonFunctionalSpecification,
): Promise<SpecificationRecord> {
  return apiFetch(`/api/specifications/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  });
}

export function generateNonFunctionalSpecification(
  projectId: number,
  regenerate = false,
): Promise<SpecificationRecord> {
  const query = regenerate ? "?regenerate=true" : "";
  return apiFetch(`/api/projects/${projectId}/specifications/non-functional${query}`, {
    method: "POST",
  });
}

export function saveSrsMetadata(
  projectId: number,
  metadata: SrsMetadata,
): Promise<{ project_id: number; updated_at: string | null }> {
  return apiFetch(`/api/projects/${projectId}/srs-document-meta`, {
    method: "PUT",
    body: JSON.stringify(metadata),
  });
}

export function getSpecificationDocument(
  projectId: number,
): Promise<SpecificationDocument> {
  return apiFetch(`/api/projects/${projectId}/specification-document`);
}

export function exportSpecificationDocument(
  projectId: number,
): Promise<{ blob: Blob; filename: string }> {
  return apiFetchBlob(`/api/projects/${projectId}/specification-document/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "docx" }),
  });
}

export function listUserStorySpecifications(
  userStoryId: number,
): Promise<SpecificationRecord[]> {
  return apiFetch(`/api/user-stories/${userStoryId}/specifications`);
}

export function getSpecification(id: number): Promise<SpecificationRecord> {
  return apiFetch(`/api/specifications/${id}`);
}

export function deleteSpecification(id: number): Promise<void> {
  return apiFetch(`/api/specifications/${id}`, { method: "DELETE" });
}

export function listProjectSpecifications(
  projectId: number,
): Promise<SpecificationRecord[]> {
  return apiFetch(`/api/projects/${projectId}/specifications`);
}

export function getLatestRequirement(
  projectId: number,
): Promise<RequirementRecord | null> {
  return listProjectRequirements(projectId).then(
    (records) => records.at(-1) ?? null,
  );
}
