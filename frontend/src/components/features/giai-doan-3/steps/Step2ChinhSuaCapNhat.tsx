import { Card, PrimaryButton, StatusBadge } from "../../../common/ui/primitives";

interface Props {
  state: {
    diagramCode: string;
  };
  consistencyResult: any;
  busy: boolean;
  onConsistencyCheck: () => Promise<void>;
}

export default function Step2ChinhSuaCapNhat({
  state,
  consistencyResult,
  busy,
  onConsistencyCheck,
}: Props) {
  const RELATION_TYPES = ["association", "include", "extend", "generalization"];

  const buildCode = () => {
    const lines = ["@startuml", "left to right direction"];

    state.actors
      .filter((actor) => actor.name.trim())
      .forEach((actor) => {
        lines.push(`actor "${actor.name}" as ${actor.name.replace(/\s+/g, "_")}`);
      });

    state.usecases
      .filter((usecase) => usecase.name.trim())
      .forEach((usecase) => {
        lines.push(`usecase "${usecase.name}" as UC_${usecase.id}`);
      });

    state.relations
      .filter((relation) => relation.from.trim() && relation.to.trim())
      .forEach((relation) => {
        lines.push(`${relation.from.replace(/\s+/g, "_")} --> ${relation.to.replace(/\s+/g, "_")} : ${relation.type}`);
      });

    state.umlClasses
      .filter((umlClass) => umlClass.name.trim())
      .forEach((umlClass) => {
        lines.push(`class ${umlClass.name} {`);
        umlClass.attributes.forEach((attribute: string) => lines.push(`  ${attribute}`));
        umlClass.methods.forEach((method: string) => lines.push(`  ${method}`));
        lines.push("}");
      });

    lines.push("@enduml");
    return lines.join("\n");
  };

  const missingDb = consistencyResult?.missing_in_database ?? [];
  const missingPlantUml = consistencyResult?.missing_in_plantuml ?? [];
  const missingRelations = consistencyResult?.missing_relations ?? [];
  const extraRelations = consistencyResult?.extra_relations ?? [];
  const issues = [
    ...missingDb.map((item: string) => ({ type: "Thiếu trong dữ liệu", detail: item })),
    ...missingPlantUml.map((item: string) => ({ type: "Thiếu trong PlantUML", detail: item })),
    ...missingRelations.map((item: any) => ({ type: "Thiếu quan hệ", detail: `${item.from} → ${item.to} (${item.type})` })),
    ...extraRelations.map((item: any) => ({ type: "Quan hệ thừa", detail: `${item.from} → ${item.to} (${item.type})` })),
  ];

  return (
    <div className="space-y-6 pb-8">
      <Card
        tone="emerald"
        title="Khắc phục sai lệch UML"
        actions={
          <PrimaryButton disabled={busy || !state.diagramCode.trim()} onClick={onConsistencyCheck}>
            {busy ? "Đang kiểm tra..." : "Kiểm tra lại"}
          </PrimaryButton>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Các sai lệch dưới đây được lấy từ kết quả kiểm tra ở Bước 1.
          </p>
          {!consistencyResult ? (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              Chưa có kết quả từ Bước 1. Hãy quay lại Bước 1 và chạy kiểm tra trước khi khắc phục.
            </div>
          ) : issues.length === 0 ? (
            <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
              Không còn sai lệch theo kết quả kiểm tra gần nhất. Hãy kiểm tra lại để xác nhận thay đổi mới nhất.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="danger">{issues.length} sai lệch cần xử lý</StatusBadge>
                <StatusBadge tone="muted">Nguồn: Bước 1</StatusBadge>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-slate-50 p-3">
                {issues.map((issue: { type: string; detail: string }, index: number) => (
                  <div key={`${issue.type}-${index}`} className="rounded-lg border border-amber-100 bg-white p-3">
                    <p className="text-xs font-semibold text-amber-800">{issue.type}</p>
                    <p className="mt-1 break-words text-sm text-slate-700">{issue.detail}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Card>

    </div>
  );
}
