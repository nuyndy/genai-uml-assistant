import type { RequirementInput } from "./types";
import { buildEarsSentence } from "./logic";

export default function EarsPreviewCard({ value }: { value: RequirementInput }) {
  return (
    <div className="bg-white rounded-2xl border-slate-200 p-6 shadow-sm space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-600">
        Văn bản yêu cầu chuẩn hóa
      </h2>
      <p className="text-sm font-medium text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-xl border-slate-100 italic">
        "{buildEarsSentence(value)}"
      </p>
    </div>
  );
}
