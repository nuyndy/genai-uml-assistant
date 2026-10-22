import { useState } from "react";
import { Card, GhostButton, PrimaryButton, EmptyState, SoftButton } from "../../../common/ui/primitives";
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

const SCENARIO_PARTS: { field: keyof Scenario; label: string; hint: string }[] = [
  { field: "mainFlow", label: "Luồng chính", hint: "Mỗi dòng là một bước trong luồng thành công." },
  { field: "altFlows", label: "Luồng thay thế", hint: "Các nhánh xử lý thay thế luồng chính." },
  { field: "exceptions", label: "Ngoại lệ", hint: "Lỗi, điều kiện thất bại và cách hệ thống xử lý." },
];
const EMPTY_SCENARIO: Scenario = { mainFlow: [], altFlows: [], exceptions: [] };
const textareaClass = "min-h-[150px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

function hasContent(lines: string[] | undefined) {
  return Boolean(lines?.some((line) => line.trim()));
}
function hasScenario(scenario: Scenario) {
  return hasContent(scenario.mainFlow) || hasContent(scenario.altFlows) || hasContent(scenario.exceptions);
}

export default function Step3UseCaseScenario({
  useCases, scenarios, updateScenario, onGenerateBatch, onGenerateSingle, onSaveScenario,
  confirmAll, busy, projectId, wrapClass,
}: Props) {
  void confirmAll;
  const [activeIndex, setActiveIndex] = useState(0);
  const activeUseCase = useCases[Math.min(activeIndex, Math.max(0, useCases.length - 1))];
  const scenario = activeUseCase ? (scenarios[activeUseCase.id] ?? EMPTY_SCENARIO) : EMPTY_SCENARIO;
  const populatedCount = useCases.filter((item) => hasScenario(scenarios[item.id] ?? EMPTY_SCENARIO)).length;

  return (
    <div className="space-y-4">
      <Card
        tone="emerald"
        title="Kịch bản Use Case"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-1 text-xs text-slate-500">{populatedCount}/{useCases.length} Use Case đã có kịch bản</span>
            <PrimaryButton disabled={busy || !projectId || useCases.length === 0} onClick={() => void onGenerateBatch()}>
              {busy ? "Đang sinh..." : "Sinh tất cả bằng AI"}
            </PrimaryButton>
          </div>
        }
      >
        {useCases.length === 0 ? (
          <EmptyState title="Chưa có Use Case" hint="Quay lại Bước 1 để tạo và lưu danh sách Use Case trước." />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">{activeIndex + 1}</span>
                <div className="min-w-0">
                  <p className={`break-words text-base font-semibold text-slate-900 ${wrapClass}`}>{activeUseCase.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {activeUseCase.specificationId !== undefined ? `Đặc tả chức năng #${activeUseCase.specificationId}` : "Chưa liên kết đặc tả"}
                    {" · "}{hasScenario(scenario) ? "Đã có nội dung kịch bản" : "Chưa có nội dung kịch bản"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <GhostButton disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}>← Trước</GhostButton>
                <GhostButton disabled={activeIndex >= useCases.length - 1} onClick={() => setActiveIndex((index) => Math.min(useCases.length - 1, index + 1))}>Sau →</GhostButton>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {SCENARIO_PARTS.map(({ field, label, hint }, index) => (
                <section key={field} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 bg-emerald-50/70 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-700 text-xs font-semibold text-white">{index + 1}</span>
                      <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
                  </div>
                  <div className="p-3">
                    <textarea
                      aria-label={label}
                      rows={6}
                      className={`${textareaClass} ${wrapClass}`}
                      value={scenario[field].join("\n")}
                      placeholder={field === "mainFlow" ? "1. Người dùng bắt đầu thao tác…\n2. Hệ thống kiểm tra dữ liệu…\n3. Hệ thống trả kết quả…" : field === "altFlows" ? "A1. Nếu người dùng chọn phương án khác…\nA2. Hệ thống xử lý nhánh thay thế…" : "E1. Nếu dữ liệu không hợp lệ…\nE2. Hệ thống thông báo lỗi và hướng xử lý…"}
                      disabled={busy}
                      onChange={(event) => updateScenario(activeUseCase.id, field, event.target.value.split("\n"))}
                    />
                  </div>
                </section>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">Nội dung được chỉnh sửa theo từng Use Case. Hãy lưu trước khi chuyển bước.</p>
              <div className="flex flex-wrap items-center gap-2">
                <SoftButton disabled={busy || !projectId} onClick={() => void onGenerateSingle(activeUseCase.id)}>
                  {busy ? "Đang sinh..." : "✦ Sinh Use Case này bằng AI"}
                </SoftButton>
                <PrimaryButton disabled={busy || !hasScenario(scenario)} onClick={() => void onSaveScenario(activeUseCase.id)}>
                  Lưu kịch bản
                </PrimaryButton>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1 pt-1">
              {useCases.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.name}
                  aria-label={`Mở Use Case ${index + 1}: ${item.name}`}
                  onClick={() => setActiveIndex(index)}
                  className={`h-2.5 rounded-full transition-all ${index === activeIndex ? "w-7 bg-emerald-700" : hasScenario(scenarios[item.id] ?? EMPTY_SCENARIO) ? "w-2.5 bg-emerald-300 hover:bg-emerald-500" : "w-2.5 bg-slate-300 hover:bg-slate-400"}`}
                />
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
