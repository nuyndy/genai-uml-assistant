import { STAGES, type StageId } from "../stages";

interface StepperProps {
  stage: StageId;
  step: number;
  maxUnlockedStep: number;
  completedSteps?: number[];
  onStepChange?: (step: number) => void;
}

export default function Stepper({
  stage,
  step,
  maxUnlockedStep,
  completedSteps,
  onStepChange,
}: StepperProps) {
  const steps = STAGES[stage].steps;
  return (
    <div className="overflow-x-auto border-b border-slate-200 bg-white">
      <ol className="mx-auto flex min-w-max max-w-6xl items-center px-4">
        {steps.map((item, index) => {
          const active = item.id === step;
          const complete = completedSteps
            ? completedSteps.includes(item.id)
            : item.id < step;
          const clickable = item.id <= maxUnlockedStep && !active;
          return (
            <li key={item.id} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepChange?.(item.id)}
                className={`flex items-center gap-2.5 py-4 ${
                  clickable ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    complete
                      ? "bg-emerald-500 text-white"
                      : active
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {complete ? "✓" : item.id}
                </span>
                <span
                  className={`max-w-44 text-left text-sm font-medium ${
                    complete
                      ? "text-emerald-600"
                      : active
                        ? "text-slate-900"
                        : "text-slate-400"
                  }`}
                >
                  {item.label}
                </span>
              </button>
              {index < steps.length - 1 && (
                <span
                  className={`mx-3 h-px flex-1 ${
                    complete ? "bg-emerald-300" : "bg-slate-200"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
