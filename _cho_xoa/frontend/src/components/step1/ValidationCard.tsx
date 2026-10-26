import type { ValidationResult } from "./types";

interface Props {
  result: ValidationResult;
  onSave: () => void;
  onReset: () => void;
}

/** Card kiểm tra tính đầy đủ cấu trúc của yêu cầu (logic thuần, không dùng AI). */
export default function ValidationCard({ result, onSave, onReset }: Props) {
  return (
    <div className="rounded-2xl border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            result.isComplete ? "bg-emerald-500" : "bg-amber-500"
          }`}
        />
        <h2 className="text-sm font-semibold text-slate-900">
          {result.isComplete
            ? "Yêu cầu đã đầy đủ cấu trúc"
            : "Cần bổ sung thêm thông tin"}
        </h2>
      </div>

      <p className="text-sm text-slate-600 leading-relaxed">
        {result.feedback}
      </p>

      {result.missingElements.length > 0 && (
        <ul className="space-y-1.5 pt-1">
          {result.missingElements.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-slate-700"
            >
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      )}

      <div className="pt-2 flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!result.isComplete}
          className="flex-1 inline-flex justify-center items-center gap-2 rounded-xl border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Lưu yêu cầu &amp; sinh đặc tả
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex justify-center items-center gap-2 rounded-xl border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Nhập mới
        </button>
      </div>
    </div>
  );
}
