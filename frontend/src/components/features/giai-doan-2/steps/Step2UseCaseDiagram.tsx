import { Card, SoftButton, PrimaryButton, DiagramPreview } from "../../../common/ui/primitives";
import { imageExtension } from "../../../../utils/imageExtension";

interface Props {
  imageUrl: string | null;
  imageCode: string | null;
  confirmed: boolean;
  busy: boolean;
  projectId?: number;
  onRegenerate: () => void;
  onSave: (nextCode: string) => void;
  onConfirm: () => void;
  onStepChange: (step: number) => void;
}

export default function Step2UseCaseDiagram({
  imageUrl,
  imageCode,
  confirmed,
  busy,
  projectId,
  onRegenerate,
  onSave,
  onConfirm,
  onStepChange,
}: Props) {
  return (
    <div className="space-y-6">
      <Card
        tone="emerald"
        title="Biểu đồ use case tổng quát"
        actions={
          <SoftButton
            disabled={busy || !projectId}
            onClick={onRegenerate}
          >
            {busy ? "Đang sinh..." : imageCode ? "↻ Sinh lại biểu đồ" : "Sinh biểu đồ"}
          </SoftButton>
        }
      >
        <DiagramPreview
          imageUrl={imageUrl}
          emptyTitle="Chưa có ảnh biểu đồ Use Case"
          emptyHint='Bấm "Sinh biểu đồ" để tạo biểu đồ tổng cho project.'
          downloadName={`use-case-diagram.${imageExtension(imageUrl)}`}
        />
        {imageCode && (
          <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs whitespace-pre-wrap">
            {imageCode}
          </div>
        )}
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-sm text-slate-700">
          {confirmed
            ? "Đã xác nhận biểu đồ Use Case."
            : "Kiểm tra ảnh và mã PlantUML trước khi xác nhận."}
        </div>
        <PrimaryButton
          disabled={busy || !imageUrl || !imageCode}
          onClick={onConfirm}
        >
          {confirmed ? "✓ Đã xác nhận biểu đồ" : "Xác nhận biểu đồ Use Case"}
        </PrimaryButton>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => onStepChange(1)} className="text-sm text-slate-500 hover:text-emerald-600">← Quay lại</button>
        <PrimaryButton disabled={!confirmed} onClick={() => onStepChange(3)}>Tiếp tục sang Bước 3</PrimaryButton>
      </div>
    </div>
  );
}
