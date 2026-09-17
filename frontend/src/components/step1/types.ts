export interface Specification {
  id: number;
  feature: string;
  type: "functional" | "non_functional";
  content: string;
}

export interface ValidationResult {
  isComplete: boolean;
  missingElements: string[];
  feedback: string;
}

export interface RequirementInput {
  actor: string;
  action: string;
  targetObject: string;
  purpose: string;
}

/** Một yêu cầu đã được lưu lại kèm đặc tả sinh tự động. */
export interface RequirementRecord extends RequirementInput {
  id: number;
  feature: string;
  content: string;
}

export const inputClass =
  "w-full rounded-lg border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100";
