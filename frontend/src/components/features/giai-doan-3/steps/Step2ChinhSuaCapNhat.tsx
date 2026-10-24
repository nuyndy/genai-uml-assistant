import { Card, PrimaryButton, SoftButton, Notice } from "../../../common/ui/primitives";

interface Props {
  state: { diagramCode: string };
  setState: (updater: (prev: any) => any) => void;
  consistencyResult: any;
  busy: boolean;
  onConsistencyCheck: () => Promise<void>;
  onSaveDiagram: () => Promise<void>;
}

export default function Step2ChinhSuaCapNhat({
  state,
  setState,
  consistencyResult,
  busy,
  onConsistencyCheck,
  onSaveDiagram,
}: Props) {
  const missingDb = consistencyResult?.missing_in_database ?? [];
  const missingPlantUml = consistencyResult?.missing_in_plantuml ?? [];
  const missingRelations = consistencyResult?.missing_relations ?? [];
  const extraRelations = consistencyResult?.extra_relations ?? [];
  const totalIssues = missingDb.length + missingPlantUml.length + missingRelations.length + extraRelations.length;
  const hasResult = consistencyResult != null;

  return (
    <div className="space-y-6 pb-2">
      <Card
        tone="emerald"
        actions={
          <div className="flex w-full flex-wrap items-center gap-2">
            {hasResult && totalIssues > 0 && (
              <div className="min-w-0 flex-1 [&>div]:w-full">
                <Notice tone="info">
                  Có {totalIssues} sai lệch từ lần kiểm tra gần nhất. Chỉnh sửa mã PlantUML bên dưới, lưu lại rồi chọn “Kiểm tra lại”.
                </Notice>
              </div>
            )}
            <SoftButton disabled={busy || !state.diagramCode.trim()} onClick={onSaveDiagram}>
              {busy ? "Đang lưu..." : "Lưu chỉnh sửa"}
            </SoftButton>
            <PrimaryButton disabled={busy || !state.diagramCode.trim()} onClick={onConsistencyCheck}>
              {busy ? "Đang xử lý..." : "Kiểm tra lại"}
            </PrimaryButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Chỉnh sửa mã PlantUML</p>
              <span className="text-xs text-slate-500">Thay đổi được cập nhật vào bản nháp khi nhập</span>
            </div>
            <textarea
              value={state.diagramCode}
              onChange={(event) => setState((prev) => ({ ...prev, diagramCode: event.target.value, consistencyChecked: false, baselineApproved: false }))}
              spellCheck={false}
              aria-label="Chỉnh sửa mã PlantUML"
              className="min-h-[360px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              placeholder="@startuml\n...\n@enduml"
            />
            <p className="mt-2 text-xs text-slate-500">
              Có thể chỉnh tên tác nhân/lớp, Use Case và các dòng quan hệ trực tiếp trong mã. Lưu chỉnh sửa trước khi kiểm tra lại.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
