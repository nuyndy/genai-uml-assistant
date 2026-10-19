import { Card, SoftButton, PrimaryButton, Notice } from "../../../common/ui/primitives";

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
      <Card
        tone="emerald"
        title="Kiểm tra nhất quán"
        actions={
          <div className="flex flex-wrap gap-2">
            <SoftButton disabled={busy || !state.diagramCode.trim()} onClick={onRenderAndSave}>
              {busy ? "Đang xử lý..." : "Render và lưu sơ đồ"}
            </SoftButton>
            <PrimaryButton disabled={busy || !state.diagramCode.trim()} onClick={onConsistencyCheck}>
              Kiểm tra UML
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
