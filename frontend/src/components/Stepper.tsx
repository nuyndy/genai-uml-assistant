interface StepperProps {
  current: 1 | 2 | 3;
  onStepClick?: (step: 1 | 2 | 3) => void;
}

const steps = [
  { id: 1, label: "Yêu cầu & Đặc tả" },
  { id: 2, label: "Kịch bản UC" },
  { id: 3, label: "Biểu đồ" },
] as const;

export default function Stepper({ current, onStepClick }: StepperProps) {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-4xl px-4">
        <ol className="flex items-center">
          {steps.map((step, index) => {
            const isActive = step.id === current;
            const isDone = step.id < current;
            const clickable = isDone && !!onStepClick;

            return (
              <li key={step.id} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onStepClick?.(step.id)}
                  className={`flex items-center gap-2.5 py-4 ${
                    clickable ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
                      isDone
                        ? "bg-emerald-500 text-white"
                        : isActive
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {isDone ? "✓" : step.id}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      isDone
                        ? "text-emerald-600"
                        : isActive
                        ? "text-slate-900"
                        : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>

                {index < steps.length - 1 && (
                  <span
                    className={`mx-3 h-px flex-1 ${
                      isDone ? "bg-emerald-300" : "bg-slate-200"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}