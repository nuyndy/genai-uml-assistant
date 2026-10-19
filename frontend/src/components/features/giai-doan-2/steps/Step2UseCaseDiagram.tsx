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
}: Props) {
  const [draftCode, setDraftCode] = useState(imageCode ?? "");

  useEffect(() => {
    setDraftCode(imageCode ?? "");
  }, [imageCode]);

  const hasCodeChanges = draftCode.trim() !== (imageCode ?? "").trim();

  return (
    <div className="space-y-3">
      <Card
        tone="emerald"
        title="Biểu đồ use case tổng quát"
        actions={
          <SoftButton disabled={busy || !projectId} onClick={onRegenerate}>
            {busy ? "Đang sinh..." : imageCode ? "↻ Sinh lại biểu đồ" : "Sinh biểu đồ"}
          </SoftButton>
        }
      >
        <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.42fr)]">
          <div className="min-w-0 overflow-hidden rounded-xl bg-emerald-50/70 p-2">
            <div className="max-h-[min(54vh,460px)] min-h-[250px] overflow-auto">
              <DiagramPreview
                imageUrl={imageUrl}
                emptyTitle="Chưa có ảnh biểu đồ Use Case"
                emptyHint='Bấm "Sinh biểu đồ" để tạo biểu đồ tổng cho project.'
                downloadName={`use-case-diagram.${imageExtension(imageUrl ?? "")}`}
              />
            </div>
          </div>
          <section className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-[#102d24]">
            <div className="border-b border-white/10 px-3 py-2 text-xs font-semibold text-emerald-100">
              Mã PlantUML
            </div>
            <textarea
              id="use-case-plantuml"
              aria-label="Mã PlantUML — có thể chỉnh sửa"
              value={draftCode}
              onChange={(event) => setDraftCode(event.target.value)}
              rows={12}
              disabled={busy || !imageCode}
              spellCheck={false}
              className="uml-code-panel min-h-[250px] max-h-[min(54vh,460px)] w-full flex-1 resize-y overflow-auto border-0 p-3 font-mono text-xs leading-5 text-emerald-100 outline-none"
            />
            {imageCode && onSave && (
              <div className="space-y-2 border-t border-white/10 px-3 py-2">
                <p className="text-[11px] text-emerald-200/80">
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
          </section>
        </div>
      </Card>
      <div className="workflow-action-bar flex flex-wrap items-center justify-between gap-3 rounded-t-xl bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-18px_rgba(10,51,35,0.55)] backdrop-blur-xl">
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
        
        
      </div>
    </div>
  );
}
