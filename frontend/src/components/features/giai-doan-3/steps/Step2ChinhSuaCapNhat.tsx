import { Card, PrimaryButton, StatusBadge } from "../../../common/ui/primitives";

interface Props {
  state: {
    diagramCode: string;
  };
  consistencyResult: any;
  busy: boolean;
  onConsistencyCheck: () => Promise<void>;
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
  consistencyResult,
  busy,
  onConsistencyCheck,
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
          <PrimaryButton disabled={busy || !state.diagramCode.trim()} onClick={onConsistencyCheck}>
            {busy ? "Đang kiểm tra..." : "Kiểm tra lại"}
          </PrimaryButton>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Danh sách sai lệch</p>
              {hasResult && (
                <StatusBadge tone={totalIssues === 0 ? "success" : "danger"}>
                  {totalIssues === 0 ? "Không có sai lệch" : `${totalIssues} sai lệch cần xử lý`}
                </StatusBadge>
              )}
            </div>

            {!hasResult ? (
              <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg bg-slate-50 px-5 py-8 text-center">
                <p className="text-sm font-medium text-slate-700">Chưa có kết quả kiểm tra</p>
                <p className="max-w-md text-sm text-slate-500">Hãy chạy kiểm tra ở Bước 1 để hiển thị các sai lệch cần khắc phục.</p>
              </div>
            ) : totalIssues === 0 ? (
              <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg bg-emerald-50 px-5 py-8 text-center">
                <p className="text-sm font-semibold text-emerald-800">Không phát hiện sai lệch</p>
                <p className="text-sm text-emerald-700">Không còn vấn đề theo kết quả kiểm tra gần nhất. Nhấn “Kiểm tra lại” để xác nhận dữ liệu mới nhất.</p>
              </div>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-slate-50 p-3">
                {missingDb.map((item: string, index: number) => <div className="rounded-md border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900" key={`db-${index}`}>Thiếu trong dữ liệu đã lưu: {item}</div>)}
                {missingPlantUml.map((item: string, index: number) => <div className="rounded-md border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900" key={`puml-${index}`}>Thiếu trong PlantUML: {item}</div>)}
                {missingRelations.map((item: any, index: number) => <div className="rounded-md border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900" key={`mr-${index}`}>Thiếu quan hệ: {item.from} → {item.to} ({item.type})</div>)}
                {extraRelations.map((item: any, index: number) => <div className="rounded-md border border-rose-100 bg-rose-50 p-3 text-sm text-rose-900" key={`er-${index}`}>Quan hệ thừa: {item.from} → {item.to} ({item.type})</div>)}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
