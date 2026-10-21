import type { WorkflowState } from "../../../../types/workflow";
import { Card } from "../../../common/ui/primitives";

interface Props { state: WorkflowState; }

function ReviewRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
      <span>{label}</span>
      <span className={ok ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
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

  return (
    <Card title="Trạng thái và kiểm tra bộ mô hình UML">
      <p className="mb-4 text-sm text-slate-600">
        Rà soát tính đầy đủ của các sản phẩm. Mỗi sản phẩm được lưu ở bước tạo hoặc chỉnh sửa;
        không cần xác nhận toàn bộ để chuyển bước.
      </p>
      <div className="space-y-2 text-sm">
        <ReviewRow label={`Actor và Use Case (${state.actors.length} tác nhân, ${state.usecases.length} use case)`} ok={actorsReady} />
        <ReviewRow label="Biểu đồ Use Case có mã và ảnh" ok={useCaseDiagramReady} />
        <ReviewRow label={`Kịch bản Use Case (${scenariosCount}/${state.usecases.length})`} ok={scenariosReady} />
        <ReviewRow label={`Biểu đồ tương tác (${interactionsCount}/${state.usecases.length})`} ok={interactionsReady} />
        <ReviewRow label={`Domain Model và Class Diagram (${state.umlClasses.length} lớp)`} ok={classDiagramReady} />
      </div>
      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Kết quả rà soát</h3>
        {complete ? (
          <p className="mt-1 text-sm text-emerald-700">Đã có đủ các sản phẩm UML chính. Có thể chuyển sang Giai đoạn 3 để đồng bộ SRS và UML.</p>
        ) : (
          <p className="mt-1 text-sm text-slate-600">Còn sản phẩm chưa hoàn tất. Quay lại đúng bước qua thanh điều hướng để bổ sung; dữ liệu đã lưu ở các bước khác vẫn được giữ nguyên.</p>
        )}
        <p className="mt-2 text-xs text-slate-500">State Machine có thể bổ sung khi hệ thống có đối tượng với vòng đời trạng thái rõ ràng; không bắt buộc với mọi use case.</p>
      </div>
    </Card>
  );
}
