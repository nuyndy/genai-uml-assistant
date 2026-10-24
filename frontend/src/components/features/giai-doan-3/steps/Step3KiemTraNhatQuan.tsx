import { Card, SoftButton, PrimaryButton, Notice, StatusBadge } from "../../../common/ui/primitives";

interface Props {
  state: {
    previewImageUrl: string | null;
    diagramCode: string;
  };
  busy: boolean;
  consistencyResult: any;
  onRenderAndSave: () => Promise<void>;
  onConsistencyCheck: () => Promise<void>;
  stage3Message: string;
  onStepChange: (step: number) => void;
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

export default function Step3KiemTraNhatQuan({
  state,
  busy,
  consistencyResult,
  onRenderAndSave,
  onConsistencyCheck,
  stage3Message,
}: Props) {
  const missingDb = consistencyResult?.missing_in_database ?? [];
  const missingPlantUml = consistencyResult?.missing_in_plantuml ?? [];
  const missingRelations = consistencyResult?.missing_relations ?? [];
  const extraRelations = consistencyResult?.extra_relations ?? [];
  const totalIssues = missingDb.length + missingPlantUml.length + missingRelations.length + extraRelations.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Tổng sai lệch" value={consistencyResult ? totalIssues : "—"} detail="Tất cả vấn đề phát hiện" tone={totalIssues ? "warn" : "neutral"} />
        <Metric label="Thiếu trong dữ liệu" value={consistencyResult ? missingDb.length : "—"} detail="Phần tử thiếu trong dữ liệu đã lưu" />
        <Metric label="Thiếu trong PlantUML" value={consistencyResult ? missingPlantUml.length : "—"} detail="Phần tử thiếu trong mã sơ đồ" />
        <Metric label="Sai lệch quan hệ" value={consistencyResult ? missingRelations.length + extraRelations.length : "—"} detail="Quan hệ thiếu hoặc thừa" />
      </div>
      <Card
        tone="emerald"
        title="Các quy tắc kiểm tra nhất quán"
        actions={
          <PrimaryButton disabled={busy || !state.diagramCode.trim()} onClick={onConsistencyCheck}>
            {busy ? "Đang kiểm tra..." : "Kiểm tra"}
          </PrimaryButton>
        }
      >
        <div className="space-y-2">
          {[
            ["CON-001", "Mỗi yêu cầu có ít nhất một Use Case liên quan hoặc có lý do ngoại lệ."],
            ["CON-002", "Mỗi Use Case có kịch bản và mục SRS tương ứng."],
            ["CON-003", "Thông điệp Sequence tham chiếu được đến phương thức phù hợp trong Class Model."],
            ["CON-004", "Tên Actor và thuật ngữ thống nhất với bảng thuật ngữ và alias."],
            ["CON-005", "Liên kết truy vết không trỏ đến phần tử không tồn tại."],
            ["CON-006", "Sơ đồ được đánh dấu đồng bộ khớp với mã PlantUML và mô hình đã lưu."],
            ["CON-007", "Baseline ghi nhận các điểm lệch còn tồn tại và lý do chấp nhận."],
            ["CON-008", "Mỗi yêu cầu chức năng/User Story có ít nhất một tiêu chí chấp nhận."],
          ].map(([code, description]) => (
            <div key={code} className="flex flex-col gap-1 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-start sm:gap-3">
              <span className="shrink-0 text-xs font-semibold text-slate-700">{code}</span>
              <span className="flex-1 text-sm text-slate-600">{description}</span>
              <StatusBadge tone={
                !consistencyResult ? "muted" :
                code === "CON-006" ? (consistencyResult.consistent ? "success" : "danger") :
                "info"
              }>
                {!consistencyResult ? "Chưa quét" :
                  code === "CON-006" ? (consistencyResult.consistent ? "Nhất quán" : "Có sai lệch") :
                  "Chưa xác minh"}
              </StatusBadge>
            </div>
          ))}
        </div>
      </Card>

      <Card
        tone="emerald"
        title="Kết quả quét sơ đồ"
      >
        {stage3Message && <Notice tone="info">{stage3Message}</Notice>}
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold">Kết quả quét sai lệch</p>
          <p className="text-sm text-slate-600">
            {consistencyResult
              ? consistencyResult.consistent
                ? "Không phát hiện sai lệch trong phạm vi kiểm tra."
                : "Đã phát hiện sai lệch giữa mô hình lưu trữ và mã PlantUML."
              : "Chạy quét sai lệch để xem danh sách vấn đề."}
          </p>
          {consistencyResult && totalIssues > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold">Danh sách sai lệch ({totalIssues})</p>
              <div className="max-h-64 space-y-2 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-3">
                {missingDb.map((item: string, index: number) => <div className="rounded-md bg-amber-50 p-2 text-sm" key={`db-${index}`}>Thiếu trong dữ liệu đã lưu: {item}</div>)}
                {missingPlantUml.map((item: string, index: number) => <div className="rounded-md bg-amber-50 p-2 text-sm" key={`puml-${index}`}>Thiếu trong PlantUML: {item}</div>)}
                {missingRelations.map((item: any, index: number) => <div className="rounded-md bg-amber-50 p-2 text-sm" key={`mr-${index}`}>Thiếu quan hệ: {item.from} → {item.to} ({item.type})</div>)}
                {extraRelations.map((item: any, index: number) => <div className="rounded-md bg-rose-50 p-2 text-sm" key={`er-${index}`}>Quan hệ thừa: {item.from} → {item.to} ({item.type})</div>)}
              </div>
            </div>
          )}
        </div>
        <div className="relative mt-4 flex min-h-[320px] items-center justify-center overflow-hidden rounded-xl border bg-slate-50">
          {state.previewImageUrl ? (
            <img src={state.previewImageUrl} alt="Xem trước biểu đồ" className="h-auto max-w-full" />
          ) : (
            <p className="p-8 text-sm text-slate-500">Render sơ đồ để xem trước trước khi duyệt baseline.</p>
          )}
        </div>
      </Card>
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <SoftButton onClick={() => onStepChange(0)}>Quay lại</SoftButton>
        <PrimaryButton onClick={() => onStepChange(1)}>Tiếp tục</PrimaryButton>
      </div>
    </div>
  );
}
