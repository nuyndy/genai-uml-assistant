import { STAGES, type StageId } from "../../stages";

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
    <div className="overflow-x-auto bg-white px-4 py-3 sm:px-6">
      <ol className="mx-auto flex w-max min-w-max max-w-full items-center gap-1 rounded-full bg-slate-100 p-1.5 sm:gap-2">
        {steps.map((item, index) => {
          const active = item.id === step;
          const complete = completedSteps
            ? completedSteps.includes(item.id)
            : item.id < step;
          const clickable = item.id <= maxUnlockedStep && !active;
          return (
            <li key={item.id} className="flex items-center">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepChange?.(item.id)}
                className={`flex min-h-10 items-center gap-2 rounded-full px-3 py-2 transition duration-200 ${
                  clickable ? "cursor-pointer hover:bg-white hover:shadow-sm" : "cursor-default"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    complete
                      ? "bg-emerald-100 text-emerald-800"
                      : active
                        ? "bg-emerald-800 text-white shadow-sm"
                        : "bg-white/70 text-slate-400"
                  }`}
                >
                  {complete ? "✓" : item.id}
                </span>
                <span
                  className={`max-w-48 text-left text-sm font-semibold ${
                    complete
                      ? "text-emerald-600"
                      : active
                        ? "text-emerald-950"
                        : "text-slate-400"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
