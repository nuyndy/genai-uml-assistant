import type { WorkflowState } from "../../../../types/workflow";
import { Card } from "../../../common/ui/primitives";

interface Props { state: WorkflowState; }

function ReviewRow({ label, detail, ok }: { label: string; detail: string; ok: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
        {ok ? "✓" : "!"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        <div className="mt-0.5 text-xs text-slate-500">{detail}</div>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
        {ok ? "Đã có dữ liệu" : "Còn thiếu"}
      </span>
    </div>
  );
}

function allScenariosReady(state: WorkflowState): boolean {
  return state.usecases.length > 0 && state.usecases.every((useCase) => {
    const scenario = state.scenarios[useCase.id];
    return Boolean(scenario && (scenario.mainFlow.length > 0 || scenario.altFlows.length > 0 || scenario.exceptions.length > 0));
  });
}

function allInteractionsReady(state: WorkflowState): boolean {
  return state.usecases.length > 0 && state.usecases.every((useCase) =>
    state.interactions.some((diagram) => diagram.usecaseId === useCase.id && Boolean(diagram.imageUrl) && Boolean(diagram.sourceCode?.trim())),
  );
}

export default function Step6UmlReview({ state }: Props) {
  const scenariosReady = allScenariosReady(state);
  const interactionsReady = allInteractionsReady(state);
  const useCaseDiagramReady = Boolean(state.useCaseDiagramUrl && state.useCaseDiagramCode?.trim());
  const classDiagramReady = state.umlClasses.length > 0 && Boolean(state.classDiagramUrl && state.classDiagramCode?.trim());
  const actorsReady = state.actors.length > 0 && state.usecases.length > 0;
  const complete = actorsReady && useCaseDiagramReady && scenariosReady && interactionsReady && classDiagramReady;
  const scenariosCount = state.usecases.filter((useCase) => {
    const scenario = state.scenarios[useCase.id];
    return Boolean(scenario && (scenario.mainFlow.length || scenario.altFlows.length || scenario.exceptions.length));
  }).length;
  const interactionsCount = state.usecases.filter((useCase) =>
    state.interactions.some((diagram) => diagram.usecaseId === useCase.id && Boolean(diagram.imageUrl) && Boolean(diagram.sourceCode?.trim())),
  ).length;
  const checks = [
    { key: "actors", label: "Tác nhân & Use Case", detail: `${state.actors.length} tác nhân · ${state.usecases.length} Use Case`, ok: actorsReady },
    { key: "usecase-diagram", label: "Biểu đồ Use Case", detail: "Mã mô tả và hình biểu đồ", ok: useCaseDiagramReady },
    { key: "scenarios", label: "Kịch bản Use Case", detail: `${scenariosCount}/${state.usecases.length} Use Case có kịch bản`, ok: scenariosReady },
    { key: "interactions", label: "Biểu đồ tương tác", detail: `${interactionsCount}/${state.usecases.length} Use Case có biểu đồ hợp lệ`, ok: interactionsReady },
    { key: "classes", label: "Domain Model & Class Diagram", detail: `${state.umlClasses.length} lớp UML · mã mô tả và hình biểu đồ`, ok: classDiagramReady },
  ];
  const readyCount = checks.filter((item) => item.ok).length;

  return (
    <div className="space-y-4 pb-10">
      <Card
        title="Tổng quan bộ mô hình UML"
        subtitle="Kiểm tra nhanh các sản phẩm đã tạo ở những bước trước."
        compact
      >
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-3xl font-bold leading-none text-emerald-800">
            {readyCount}<span className="text-base font-semibold text-emerald-700">/5</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-800">{complete ? "Bộ mô hình đã sẵn sàng" : "Tiến độ hoàn thiện mô hình"}</div>
            <div className="mt-1 text-xs text-slate-500">{readyCount} trên 5 hạng mục đã đạt điều kiện kiểm tra.</div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${readyCount / 5 * 100}%` }} />
            </div>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {complete ? "Đầy đủ" : "Cần rà soát"}
          </span>
        </div>
      </Card>

      <Card title="Danh sách kiểm tra" subtitle="Mỗi mục cho biết dữ liệu đã có và phần còn cần bổ sung." compact>
        <div className="space-y-2">
          {checks.map((item) => (
            <ReviewRow key={item.key} label={item.label} detail={item.detail} ok={item.ok} />
          ))}
        </div>
      </Card>

      <Card title="Kết quả rà soát" compact>
        <div className={`rounded-xl border p-4 ${complete ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/60"}`}>
          <div className="flex items-start gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg font-bold ${complete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {complete ? "✓" : "!"}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">{complete ? "Bộ mô hình UML đã đủ điều kiện" : "Một số hạng mục cần hoàn thiện"}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {complete
                  ? "Các sản phẩm UML chính đã có. Bạn có thể chuyển sang Giai đoạn 3 để đồng bộ SRS và UML."
                  : "Quay lại bước tương ứng trên thanh điều hướng để bổ sung dữ liệu. Nội dung đã lưu ở các bước khác vẫn được giữ nguyên."}
              </p>
            </div>
          </div>
          <p className="mt-3 border-t border-current/10 pt-3 text-xs leading-5 text-slate-500">
            State Machine chỉ cần bổ sung khi hệ thống có đối tượng với vòng đời trạng thái rõ ràng; không bắt buộc cho mọi Use Case.
          </p>
        </div>
      </Card>
    </div>
  );
}
