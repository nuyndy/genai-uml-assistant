import { STAGES, STAGE_ORDER, type StageId } from "../../stages";

interface GiaiDoanStepperProps {
  stage: StageId;
  onStageChange?: (stage: StageId) => void;
  maxUnlockedStage: StageId;
  completedStages: StageId[];
}

/** Thanh điều hướng 3 giai đoạn gọn, dùng trực tiếp trong hàng header chung. */
export default function GiaiDoanStepper({
  stage,
  onStageChange,
  maxUnlockedStage,
  completedStages,
}: GiaiDoanStepperProps) {
  return (
    <nav aria-label="Các giai đoạn của quy trình" className="w-full min-w-0">
      <ol className="mx-auto flex w-full max-w-3xl items-center gap-1 rounded-full bg-[#EAF3EF] p-1 sm:gap-1.5">
        {STAGE_ORDER.map((id) => {
          const def = STAGES[id];
          const active = id === stage;
          const done = completedStages.includes(id);
          const unlocked = id <= maxUnlockedStage;
          const clickable = unlocked && !active && Boolean(onStageChange);

          return (
            <li key={id} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!clickable}
                aria-current={active ? "step" : undefined}
                aria-label={`Giai đoạn ${id}: ${def.short}${done ? ", đã hoàn thành" : unlocked ? "" : ", đang khóa"}`}
                title={`Giai đoạn ${id}: ${def.short}`}
                onClick={() => clickable && onStageChange?.(id)}
                className={`flex min-h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-full px-1.5 py-2 text-center text-xs font-semibold transition sm:gap-2 sm:px-3 sm:text-sm ${
                  active
                    ? "bg-[#184F47] text-[#F5FAF7] shadow-sm"
                    : done
                      ? "text-[#236554] hover:bg-white"
                      : unlocked
                        ? "text-slate-600 hover:bg-white"
                        : "cursor-not-allowed text-slate-400"
                }`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  active
                    ? "bg-[#B6CF66] text-[#123F3A]"
                    : done
                      ? "bg-[#C8DDD7] text-[#184F47]"
                      : unlocked
                        ? "bg-white text-slate-600"
                        : "bg-slate-200 text-slate-400"
                }`}>
                  {done ? "✓" : unlocked ? id : "🔒"}
                </span>
                <span className="min-w-0 truncate">{def.short}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
