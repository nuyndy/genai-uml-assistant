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

export default function Step3KiemTraNhatQuan({
  state,
  busy,
  consistencyResult,
  onRenderAndSave,
  onConsistencyCheck,
  stage3Message,
}: Props) {
  return (
    <div className="space-y-6">
      <Card tone="emerald" title="Phạm vi quét nhất quán">
        <p className="mb-3 text-sm text-slate-600">
          Quét theo 8 quy tắc chính thức trong luồng hệ thống. Quy tắc chưa đủ dữ liệu sẽ được đánh dấu chưa thể xác minh, không tự động coi là đạt.
        </p>
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
              <StatusBadge tone={consistencyResult && code === "CON-006" ? (consistencyResult.consistent ? "success" : "danger") : "muted"}>
                {consistencyResult && code === "CON-006" ? (consistencyResult.consistent ? "Đã kiểm tra" : "Có sai lệch") : "Chưa xác minh"}
              </StatusBadge>
            </div>
          ))}
        </div>
      </Card>

      <Card
        tone="emerald"
        title="Quét và phát hiện sai lệch UML"
        actions={
          <div className="flex flex-wrap gap-2">
            <SoftButton disabled={busy || !state.diagramCode.trim()} onClick={onRenderAndSave}>
              {busy ? "Đang xử lý..." : "Render và lưu sơ đồ"}
            </SoftButton>
            <PrimaryButton disabled={busy || !state.diagramCode.trim()} onClick={onConsistencyCheck}>
              Quét sai lệch
            </PrimaryButton>
          </div>
        }
      >
        {stage3Message && <Notice tone="info">{stage3Message}</Notice>}
        <div className="mt-4 rounded-xl border border-slate-200 p-4 text-sm">
          <p className="font-medium">Kết quả kiểm tra</p>
          <p className="mt-1 text-slate-600">
            {consistencyResult
              ? consistencyResult.consistent
                ? "Không phát hiện sai lệch trong phạm vi kiểm tra."
                : "Đã phát hiện sai lệch giữa mô hình lưu trữ và mã PlantUML."
              : "Chưa chạy kiểm tra nhất quán."}
          </p>
          {consistencyResult && !consistencyResult.consistent && (
            <ul className="mt-3 list-disc space-y-1 pl-5">
              {(consistencyResult.missing_in_database ?? []).map((item: string, index: number) => (
                <li key={`db-${index}`}>Thiếu trong dữ liệu đã lưu: {item}</li>
              ))}
              {(consistencyResult.missing_in_plantuml ?? []).map((item: string, index: number) => (
                <li key={`puml-${index}`}>Thiếu trong PlantUML: {item}</li>
              ))}
              {(consistencyResult.missing_relations ?? []).map((item: any, index: number) => (
                <li key={`mr-${index}`}>Thiếu quan hệ: {item.from} → {item.to} ({item.type})</li>
              ))}
              {(consistencyResult.extra_relations ?? []).map((item: any, index: number) => (
                <li key={`er-${index}`}>Quan hệ thừa: {item.from} → {item.to} ({item.type})</li>
              ))}
            </ul>
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
      <div className="flex justify-between gap-3">
        
        
      </div>
    </div>
  );
}
