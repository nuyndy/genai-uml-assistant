import { Card, PrimaryButton, SoftButton, Notice } from "../../../common/ui/primitives";

interface Props {
  state: { diagramCode: string };
  setState: (updater: (prev: any) => any) => void;
  consistencyResult: any;
  busy: boolean;
  onConsistencyCheck: () => Promise<void>;
  onSaveDiagram: () => Promise<void>;
}

function Metric({ label, value, detail, tone = "neutral" }: {
  label: string;
  value: number | string;
  detail: string;
  tone?: "neutral" | "success" | "warn";
}) {
  const styles = {
    neutral: "border-slate-200 bg-white text-slate-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <div className={`flex min-w-0 items-center justify-start gap-3 rounded-xl border px-4 py-3 ${styles[tone]}`}>
      <div className="flex h-14 w-16 shrink-0 items-center justify-center">
        <p className="text-3xl font-bold leading-none tracking-tight sm:text-4xl">{value}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{label}</p>
        <p className="mt-1 text-xs leading-tight opacity-70">{detail}</p>
      </div>
    </div>
  );
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
  const relationIssues = missingRelations.length + extraRelations.length;
  const hasResult = consistencyResult != null;

  return (
    <div className="space-y-6 pb-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Tổng sai lệch" value={hasResult ? totalIssues : "—"} detail="Tất cả vấn đề cần xử lý" tone={totalIssues > 0 ? "warn" : hasResult ? "success" : "neutral"} />
        <Metric label="Thiếu trong dữ liệu" value={hasResult ? missingDb.length : "—"} detail="Phần tử thiếu trong dữ liệu đã lưu" />
        <Metric label="Thiếu trong PlantUML" value={hasResult ? missingPlantUml.length : "—"} detail="Phần tử thiếu trong mã sơ đồ" />
        <Metric label="Sai lệch quan hệ" value={hasResult ? relationIssues : "—"} detail="Quan hệ thiếu hoặc thừa" />
      </div>

      <Card
        tone="emerald"
        title={<span className="text-xl sm:text-2xl">Khắc phục sai lệch UML</span>}
        actions={
          <div className="flex flex-wrap gap-2">
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
          {hasResult && totalIssues > 0 && (
            <Notice tone="info">
              Có {totalIssues} sai lệch từ lần kiểm tra gần nhất. Chỉnh sửa mã PlantUML bên dưới, lưu lại rồi chọn “Kiểm tra lại”. Danh sách sai lệch đã được ẩn theo yêu cầu.
            </Notice>
          )}
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
