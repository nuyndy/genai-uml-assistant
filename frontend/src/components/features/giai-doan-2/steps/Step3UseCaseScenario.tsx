import { useState } from "react";
import {
  Card,
  GhostButton,
  PrimaryButton,
  EmptyState,
  SoftButton,
} from "../../../common/ui/primitives";
import type { Scenario } from "../../../../types/workflow";

interface ScenarioUseCase {
  id: number;
  name: string;
  specificationId?: number;
}

interface Props {
  useCases: ScenarioUseCase[];
  scenarios: Record<number, Scenario>;
  updateScenario: (useCaseId: number, field: keyof Scenario, lines: string[]) => void;
  onGenerateBatch: () => void | Promise<void>;
  onGenerateSingle: (useCaseId: number) => void | Promise<void>;
  onSaveScenario: (useCaseId: number) => void | Promise<void>;
  confirmAll: () => void;
  confirmed: boolean;
  busy: boolean;
  projectId?: number;
  onStepChange: (step: number) => void;
  wrapClass: string;
}

const SCENARIO_PARTS: [keyof Scenario, string][] = [
  ["mainFlow", "Luồng chính"],
  ["altFlows", "Luồng phụ"],
  ["exceptions", "Ngoại lệ"],
];

const EMPTY_SCENARIO: Scenario = { mainFlow: [], altFlows: [], exceptions: [] };

function hasMainFlow(scenario: Scenario | undefined): boolean {
  return Boolean(scenario?.mainFlow.some((line) => line.trim()));
}

export default function Step3UseCaseScenario({
  useCases,
  scenarios,
  updateScenario,
  onGenerateBatch,
  onGenerateSingle,
  onSaveScenario,
  confirmAll,
  busy,
  projectId,
  wrapClass,
}: Props) {
  void confirmAll;
  const [expandedIds, setExpandedIds] = useState<number[]>([]);

  const toggle = (id: number) =>
    setExpandedIds((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );


  return (
    <div className="space-y-5">
      <Card
        tone="emerald"
        title="Sinh kịch bản use case"
        actions={
          <PrimaryButton
            disabled={busy || !projectId || useCases.length === 0}
            onClick={() => void onGenerateBatch()}
          >
            {busy ? "Đang sinh..." : "Sinh kịch bản cho tất cả"}
          </PrimaryButton>
        }
      >
        {useCases.length === 0 ? (
          <EmptyState
            title="Chưa có use case"
            hint="Quay lại Bước 1 để lưu danh sách use case."
          />
        ) : (
          <div className="space-y-3">
            {useCases.map((useCase) => {
              const scenario = scenarios[useCase.id] ?? EMPTY_SCENARIO;
              const open = expandedIds.includes(useCase.id);
              return (
                <section
                  key={useCase.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className={`break-words text-sm font-semibold text-slate-900 ${wrapClass}`}>
                        {useCase.name}
                      </p>
                      {useCase.specificationId !== undefined && (
                        <p className="mt-1 text-xs text-slate-500">
                          Đặc tả ID {useCase.specificationId}
                        </p>
                      )}
                    </div>
                    {hasMainFlow(scenario) ? (
                      <span className="text-xs font-medium text-emerald-600">Đã có kịch bản</span>
                    ) : (
                      <span className="text-xs text-slate-400">Chưa sinh</span>
                    )}
                    <SoftButton
                      disabled={busy || !projectId}
                      onClick={() => void onGenerateSingle(useCase.id)}
                    >
                      Sinh kịch bản
                    </SoftButton>
                    <GhostButton onClick={() => toggle(useCase.id)}>
                      {open ? "Thu gọn" : "Xem và sửa"}
                    </GhostButton>
                  </div>

                  {open && (
                    <div className="space-y-5 border-t border-slate-100 bg-slate-50/70 p-5">
                      {SCENARIO_PARTS.map(([field, label]) => (
                        <div key={field} className="min-w-0">
                          <p className="mb-1 text-xs font-semibold text-slate-700">{label}</p>
                          <textarea
                            rows={5}
                            className={`w-full rounded-lg border p-2 text-sm ${wrapClass}`}
                            value={scenario[field].join("\n")}
                            onChange={(event) =>
                              updateScenario(useCase.id, field, event.target.value.split("\n"))
                            }
                          />
                        </div>
                      ))}
                      <div className="flex justify-end">
                        <PrimaryButton
                          disabled={busy || !hasMainFlow(scenario)}
                          onClick={() => void onSaveScenario(useCase.id)}
                        >
                          Lưu kịch bản
                        </PrimaryButton>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Card>


      <div className="flex flex-wrap items-center justify-between gap-3">
        
        
      </div>
    </div>
  );
}