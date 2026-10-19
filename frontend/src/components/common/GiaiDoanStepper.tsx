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
      className="relative z-10 border-b border-emerald-950/5 bg-white/90 backdrop-blur-xl"
    >
      <div className="mx-auto w-full max-w-[1600px] px-4 py-2 sm:px-6 lg:px-8">
        <ol className="mx-auto flex max-w-4xl items-center gap-1 rounded-full bg-slate-100/90 p-1.5 shadow-inner sm:gap-2">
          {STAGE_ORDER.map((id) => {
            const def = STAGES[id];
            const isActive = id === stage;
            const isDone = completedStages.includes(id);
            const unlocked = id <= maxUnlockedStage;
            const clickable = unlocked && !isActive && !!onStageChange;

            return (
              <li key={id} className="min-w-0 flex-1">
                <button
                  type="button"
                  disabled={!clickable}
                  aria-current={isActive ? "step" : undefined}
                  title={def.label}
                  onClick={() => clickable && onStageChange?.(id)}
                  className={`flex min-h-12 min-w-0 w-full items-center justify-center gap-2 rounded-full px-3 py-2.5 text-left transition duration-200 sm:justify-start sm:px-4 ${
                    clickable
                      ? "cursor-pointer hover:bg-white hover:shadow-sm"
                      : "cursor-default"
                  } ${isActive ? "bg-emerald-800 text-white shadow-md shadow-emerald-950/15" : ""}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${
                      isDone
                        ? "bg-emerald-100 text-emerald-800"
                        : isActive
                          ? "bg-white text-emerald-900 shadow-sm"
                          : unlocked
                            ? "bg-white text-slate-600"
                            : "bg-transparent text-slate-400"
                    }`}
                  >
                    {isDone ? "✓" : id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`hidden truncate text-[10px] font-semibold uppercase tracking-wider sm:block ${
                        isActive
                          ? "text-emerald-100"
                          : isDone
                            ? "text-emerald-600"
                            : "text-slate-400"
                      }`}
                    >
                      Giai đoạn {id}
                    </span>
                    <span
                      className={`block truncate text-xs font-semibold sm:text-sm ${
                        isActive
                          ? "text-white"
                          : isDone
                            ? "text-emerald-800"
                            : unlocked
                              ? "text-slate-600"
                              : "text-slate-400"
                      }`}
                    >
                      {def.short}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Dòng tiến trình tổng thể của cả 3 giai đoạn. */}
        <div className="mx-auto mt-2 flex max-w-4xl items-center gap-3 px-3">
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tiến trình tổng thể"
            className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100"
          >
            <div
              className="h-full rounded-full bg-emerald-700 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-500">
            {done}/{STAGE_ORDER.length} giai đoạn
          </span>
        </div>
      </div>
    </nav>
  );
}
