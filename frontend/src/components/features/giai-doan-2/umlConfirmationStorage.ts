import type { WorkflowState } from "../../../types/workflow";

export const UML_CONFIRMATION_FLAGS = [
  "actorsUseCasesConfirmed",
  "useCaseDiagramConfirmed",
  "scenariosConfirmed",
  "interactionsConfirmed",
  "classDiagramConfirmed",
] as const;

export type UmlConfirmationState = Pick<
  WorkflowState,
  (typeof UML_CONFIRMATION_FLAGS)[number]
>;

function storageKey(projectId: number): string {
  return `genai-uml-confirmations:${projectId}`;
}

export function readUmlConfirmations(
  projectId: number,
): Partial<UmlConfirmationState> {
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const result: Partial<UmlConfirmationState> = {};
    for (const key of UML_CONFIRMATION_FLAGS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "boolean") result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export function writeUmlConfirmations(
  projectId: number,
  confirmations: UmlConfirmationState,
): void {
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(confirmations));
  } catch {
    // Storage có thể bị trình duyệt chặn; xác nhận vẫn có hiệu lực trong phiên hiện tại.
  }
}
