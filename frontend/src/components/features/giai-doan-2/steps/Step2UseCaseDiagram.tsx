import { useEffect, useState } from "react";
import { Card, SoftButton, PrimaryButton, DiagramPreview } from "../../../common/ui/primitives";
import { imageExtension } from "../../../../utils/imageExtension";

interface Props {
  imageUrl: string | null;
  imageCode: string | null;
  confirmed: boolean;
  busy: boolean;
  projectId?: number;
  onRegenerate: () => void;
  onSave?: (nextCode: string) => void;
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
  const [draftCode, setDraftCode] = useState(imageCode ?? "");

  useEffect(() => {
    setDraftCode(imageCode ?? "");
  }, [imageCode]);

  const hasCodeChanges = draftCode.trim() !== (imageCode ?? "").trim();

  return (
    <div className="space-y-6">
      <Card
        tone="emerald"
        title="Biểu đồ use case tổng quát"
        actions={
          <SoftButton disabled={busy || !projectId} onClick={onRegenerate}>
            {busy ? "Đang sinh..." : imageCode ? "↻ Sinh lại biểu đồ" : "Sinh biểu đồ"}
          </SoftButton>
        }
      >
        <DiagramPreview
          imageUrl={imageUrl}
          emptyTitle="Chưa có ảnh biểu đồ Use Case"
          emptyHint='Bấm "Sinh biểu đồ" để tạo biểu đồ tổng cho project.'
          downloadName={`use-case-diagram.${imageExtension(imageUrl ?? "")}`}
        />
        {imageCode && (
          <div className="mt-4 space-y-3">
            <label htmlFor="use-case-plantuml" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Mã PlantUML — có thể chỉnh sửa
            </label>
            <textarea
              id="use-case-plantuml"
              value={draftCode}
              onChange={(event) => setDraftCode(event.target.value)}
              rows={Math.min(18, Math.max(6, draftCode.split("\n").length))}
              disabled={busy}
              spellCheck={false}
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100/40"
            />
            {onSave && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {hasCodeChanges ? "Có thay đổi chưa render lại thành ảnh." : "Mã đang khớp với phiên bản đã render."}
                </p>
                <PrimaryButton
                  disabled={busy || !hasCodeChanges || !draftCode.trim()}
                  onClick={() => onSave(draftCode)}
                >
                  {busy ? "Đang lưu..." : "Lưu mã và render lại"}
                </PrimaryButton>
              </div>
            )}
          </div>
        )}
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-sm text-slate-700">
          {confirmed
            ? "Đã xác nhận biểu đồ Use Case."
            : "Kiểm tra ảnh và mã PlantUML trước khi xác nhận."}
        </div>
        <PrimaryButton disabled={busy || !imageUrl || !imageCode || hasCodeChanges} onClick={onConfirm}>
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
