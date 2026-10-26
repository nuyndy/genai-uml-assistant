import { apiFetch } from "../common/services/api";

export interface Project {
  id: number;
  name: string;
  created_at: string | null;
}

export function listProjects(): Promise<Project[]> {
  return apiFetch("/api/projects");
}

export function createProject(name: string): Promise<Project> {
  return apiFetch("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: name.trim() }),
  });
}

export function deleteProject(projectId: number): Promise<void> {
  return apiFetch(`/api/projects/${projectId}`, { method: "DELETE" });
}
