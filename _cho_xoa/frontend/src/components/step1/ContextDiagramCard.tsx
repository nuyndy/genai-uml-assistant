import type { RequirementInput } from "./types";

/** Card dựng Biểu đồ Ngữ cảnh trực quan (Actor ➜ Hệ thống). */
export default function ContextDiagramCard({ value }: { value: RequirementInput }) {
  const { actor, action, targetObject } = value;

  return (
    <div className="bg-white rounded-2xl border-slate-200 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-900">
          Biểu đồ ngữ cảnh trực quan
        </h2>
      </div>

      <div className="min-h-[220px] bg-slate-50 rounded-xl border-dashed border-slate-200 p-6 flex items-center justify-center">
        {actor && action ? (
          <div className="w-full flex items-center justify-between gap-2 max-w-md">
            <div className="flex flex-col items-center">
              <div className="bg-violet-600 text-white font-medium text-xs px-4 py-3 rounded-xl shadow-md text-center min-w-[90px]">
                👤 {actor || "Actor"}
              </div>
            </div>

            <div className="flex-1 flex-col items-center px-2">
              <span className="text-xs font-medium text-violet-700 bg-violet-50 border-violet-100 px-2 py-1 rounded-md text-center mb-1 max-w-[140px] truncate">
                {action} {targetObject ? `(${targetObject})` : ""}
              </span>
              <div className="w-full flex items-center">
                <div className="h-0.5 bg-violet-400 w-full" />
                <span className="text-violet-500 font-bold -ml-1 text-xs">►</span>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="bg-slate-900 text-white font-medium text-xs px-4 py-3 rounded-xl shadow-md text-center min-w-[100px]">
                💻 Hệ thống GenAI
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center">
            Sơ đồ ngữ cảnh sẽ được dựng tự động <br /> khi bạn điền thông tin vào form...
          </p>
        )}
      </div>
    </div>
  );
}
