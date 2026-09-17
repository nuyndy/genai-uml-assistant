import { apiFetch } from "./api";

export interface RequirementPayload {
  project_id: number;
  actor: string;
  feature: string;
  benefit: string;
  precondition?: string | null;
  constraint?: string | null;
}

export interface RequirementCreated {
  message: string;
  id: number;
}

/**
 * Lưu một yêu cầu lên backend (endpoint được bảo vệ, cần Authorization).
 * Dùng token qua apiFetch; nếu token hết hạn, apiFetch tự phát sự kiện đăng xuất.
 */
export function saveRequirement(
  payload: RequirementPayload,
): Promise<RequirementCreated> {
  return apiFetch<RequirementCreated>("/api/requirements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
