import { STAGES, STAGE_ORDER, type StageId } from "../../stages";

interface GiaiDoanStepperProps {
  /** Giai đoạn lớn đang mở. */
  stage: StageId;
  onStageChange?: (stage: StageId) => void;
  /** Giai đoạn tối đa được phép mở. */
  maxUnlockedStage: StageId;
  /**
   * Các giai đoạn đã thực sự hoàn thành, suy ra từ dữ liệu trong database
   * (đã xác nhận yêu cầu, đã sinh đặc tả, đã có mô hình UML).
   *
   * Chỉ những giai đoạn nằm trong danh sách này mới được tô xanh: bấm sang
   * giai đoạn sau không đồng nghĩa với việc giai đoạn trước đã xong.
   */
  completedStages: StageId[];
}

/**
 * Thanh 3 GIAI ĐOẠN lớn, đặt trên cùng workspace; ngay bên dưới là sub-stepper
 * riêng của giai đoạn đang chọn.
 *
 * Giai đoạn đã hoàn thành thật (theo dữ liệu) được tô xanh lá, cùng ngôn ngữ
 * thị giác với sub-stepper. Nhãn được cắt gọn bằng truncate để không tràn khi
 * màn hình hẹp.
 */
export default function GiaiDoanStepper({
  stage,
  onStageChange,
  maxUnlockedStage,
  completedStages,
}: GiaiDoanStepperProps) {
  const done = completedStages.length;
  const percent = Math.round((done / STAGE_ORDER.length) * 100);

  return (
    <nav
      aria-label="Các giai đoạn của quy trình"
      className="border-b border-slate-200 bg-white"
    >
      <div className="mx-auto max-w-6xl px-4 py-3">
        <ol className="flex items-center gap-2">
          {STAGE_ORDER.map((id, index) => {
            const def = STAGES[id];
            const isActive = id === stage;
            const isDone = completedStages.includes(id);
            const unlocked = id <= maxUnlockedStage;
            const clickable = unlocked && !isActive && !!onStageChange;

            return (
              <li key={id} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  disabled={!clickable}
                  aria-current={isActive ? "step" : undefined}
                  title={def.label}
                  onClick={() => clickable && onStageChange?.(id)}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1.5 py-2 text-left transition sm:px-2 ${
                    clickable
                      ? "cursor-pointer hover:bg-slate-50"
                      : "cursor-default"
                  } ${isActive ? "bg-violet-50 ring-1 ring-violet-200" : ""}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold shadow-sm transition ${
                      isDone
                        ? "bg-emerald-500 text-white"
                        : isActive
                          ? "bg-violet-600 text-white"
                          : unlocked
                            ? "bg-slate-200 text-slate-600"
                            : "bg-slate-100 text-slate-300"
                    }`}
                  >
                    {isDone ? "✓" : id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[11px] font-semibold uppercase tracking-wider ${
                        isActive
                          ? "text-violet-600"
                          : isDone
                            ? "text-emerald-600"
                            : "text-slate-400"
                      }`}
                    >
                      Giai đoạn {id}
                    </span>
                    <span
                      className={`block truncate text-sm font-medium ${
                        isActive
                          ? "text-slate-900"
                          : isDone
                            ? "text-emerald-700"
                            : unlocked
                              ? "text-slate-600"
                              : "text-slate-300"
                      }`}
                    >
                      {def.short}
                    </span>
                  </span>
                </button>

                {index < STAGE_ORDER.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`hidden h-1 w-6 shrink-0 rounded-full sm:block ${
                      isDone
                        ? "bg-emerald-400"
                        : "bg-slate-200"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>

        {/* Dòng tiến trình tổng thể của cả 3 giai đoạn. */}
        <div className="mt-3 flex items-center gap-3">
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tiến trình tổng thể"
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-emerald-500 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-400">
            {done}/{STAGE_ORDER.length} giai đoạn
          </span>
        </div>
      </div>
    </nav>
  );
}
