import { useState } from "react";
import { GhostButton, PrimaryButton, EmptyState, SoftButton } from "../../../common/ui/primitives";
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
const textareaClass = "min-h-[108px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-5 text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

function hasContent(lines: string[] | undefined) {
  return Boolean(lines?.some((line) => line.trim()));
}
function hasScenario(scenario: Scenario) {
  return hasContent(scenario.mainFlow) || hasContent(scenario.altFlows) || hasContent(scenario.exceptions);
}

export default function Step3UseCaseScenario({
  useCases, scenarios, updateScenario, onGenerateSingle, onSaveScenario,
  confirmAll, busy, projectId, wrapClass,
}: Props) {
  void confirmAll;
  const [activeIndex, setActiveIndex] = useState(0);
  const activeUseCase = useCases[Math.min(activeIndex, Math.max(0, useCases.length - 1))];
  const scenario = activeUseCase ? (scenarios[activeUseCase.id] ?? EMPTY_SCENARIO) : EMPTY_SCENARIO;

  return (
    <div className="space-y-5 pb-2">
      <div className="space-y-4">
        {useCases.length === 0 ? (
          <EmptyState title="Chưa có Use Case" hint="Quay lại Bước 1 để tạo và lưu danh sách Use Case trước." />
        ) : (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3 shadow-sm">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <GhostButton disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} aria-label="Use Case trước">‹</GhostButton>
                <div className="min-w-0">
                  <p className={`break-words text-base font-semibold text-slate-900 ${wrapClass}`}>{activeUseCase.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {activeUseCase.specificationId !== undefined ? `Đặc tả chức năng #${activeUseCase.specificationId}` : "Chưa liên kết đặc tả"}
                    {" · "}{hasScenario(scenario) ? "Đã có nội dung kịch bản" : "Chưa có nội dung kịch bản"}
                  </p>
                </div>
                <GhostButton disabled={activeIndex >= useCases.length - 1} onClick={() => setActiveIndex((index) => Math.min(useCases.length - 1, index + 1))} aria-label="Use Case tiếp theo">›</GhostButton>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <SoftButton disabled={busy || !projectId || !activeUseCase} onClick={() => activeUseCase && void onGenerateSingle(activeUseCase.id)}>
                  {busy ? "Đang sinh..." : "✦ Sinh bằng AI"}
                </SoftButton>
                <PrimaryButton disabled={busy || !hasScenario(scenario) || !activeUseCase} onClick={() => activeUseCase && void onSaveScenario(activeUseCase.id)}>
                  Lưu
                </PrimaryButton>
              </div>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 pb-1 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.6fr)]">
              <section className="min-w-0 h-[calc(100dvh-240px)] rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="h-full overflow-y-auto overscroll-contain pr-2">
                  <label className="block min-w-0 text-xs font-semibold text-slate-600">
                    Tên ca sử dụng
                    <input value={activeUseCase.name} readOnly className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm font-normal text-slate-700" />
                  </label>
                  {([
                    ["actor", "Tác nhân", "Ví dụ: Người dùng, Quản trị viên"],
                    ["description", "Mô tả", "Mục đích và phạm vi của ca sử dụng"],
                    ["preconditions", "Tiền điều kiện", "Điều kiện cần có trước khi bắt đầu"],
                    ["minimalGuarantees", "Đảm bảo tối thiểu", "Điều hệ thống phải bảo đảm khi thất bại"],
                    ["postconditions", "Hậu điều kiện", "Trạng thái sau khi ca sử dụng kết thúc"],
                  ] as const).map(([field, label, placeholder]) => (
                    <label key={field} className="block min-w-0 text-xs font-semibold text-slate-600">
                      {label}
                      <textarea
                        rows={2}
                        value={(scenario[field] ?? []).join("\n")}
                        placeholder={placeholder}
                        disabled={busy}
                        onChange={(event) => updateScenario(activeUseCase.id, field, event.target.value.split("\n"))}
                        className={`mt-1 min-h-[58px] w-full resize-y overflow-auto rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm font-normal leading-5 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 ${wrapClass}` }
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section className="min-w-0 h-[calc(100dvh-240px)] rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Luồng xử lý</h3>
                <div className="h-[calc(100%-32px)] space-y-4 overflow-y-auto overscroll-contain pr-2">
                  {SCENARIO_PARTS.map(({ field, label, hint }, index) => (
                    <section key={field} className="min-w-0">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-xs font-semibold text-white">{index + 1}</span>
                        <h4 className="text-sm font-semibold text-slate-800">{label}</h4>
                      </div>
                      <p className="mb-2 text-xs leading-5 text-slate-500">{hint}</p>
                      <textarea
                        aria-label={label}
                        rows={5}
                        className={`${textareaClass} min-h-[140px] resize-y ${wrapClass}`}
                        value={scenario[field].join("\n")}
                        placeholder={field === "mainFlow" ? "1. Người dùng bắt đầu thao tác…\n2. Hệ thống kiểm tra dữ liệu…\n3. Hệ thống trả kết quả…" : field === "altFlows" ? "A1. Nếu người dùng chọn phương án khác…\nA2. Hệ thống xử lý nhánh thay thế…" : "E1. Nếu dữ liệu không hợp lệ…\nE2. Hệ thống thông báo lỗi và hướng xử lý…"}
                        disabled={busy}
                        onChange={(event) => updateScenario(activeUseCase.id, field, event.target.value.split("\n"))}
                      />
                    </section>
                  ))}
                </div>
              </section>
            </div>


          </div>
        )}
      </div>
    </div>
  );
}
