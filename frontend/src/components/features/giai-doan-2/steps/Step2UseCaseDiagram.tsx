import { useEffect, useState } from "react";
import { Card, SoftButton, PrimaryButton } from "../../../common/ui/primitives";
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
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setDraftCode(imageCode ?? "");
  }, [imageCode]);

  const hasCodeChanges = draftCode.trim() !== (imageCode ?? "").trim();

  return (
    <div className="space-y-3">
      <Card tone="emerald" title="Biểu đồ Use Case">
        <div className="flex flex-wrap items-center justify-start gap-2 border-b border-slate-100 pb-3">
          <SoftButton disabled={busy || !projectId} onClick={onRegenerate}>{busy ? "Đang sinh..." : imageCode ? "↻ Sinh lại biểu đồ" : "Sinh biểu đồ"}</SoftButton>
          <SoftButton disabled={!imageUrl} onClick={() => { if (!imageUrl) return; const link = document.createElement("a"); link.href = imageUrl; link.download = "use-case-diagram." + imageExtension(imageUrl); link.target = "_blank"; link.rel = "noreferrer"; link.click(); }}>↓ Tải ảnh về</SoftButton>
          <span className="mx-1 h-6 border-l border-slate-200" />
          <SoftButton disabled={!imageUrl || zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))}>−</SoftButton>
          <span className="min-w-12 text-center text-xs tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
          <SoftButton disabled={!imageUrl || zoom >= 2.5} onClick={() => setZoom((value) => Math.min(2.5, Number((value + 0.25).toFixed(2))))}>+</SoftButton>
          <SoftButton disabled={!imageUrl || zoom === 1} onClick={() => setZoom(1)}>Vừa khung</SoftButton>
        </div>
        <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-[#102d24]">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2"><span className="text-xs font-semibold text-emerald-100">Mã PlantUML</span><span className="text-[11px] text-emerald-200/80">{hasCodeChanges ? "Chưa render thay đổi" : "Đã đồng bộ với ảnh"}</span></div>
          <textarea id="use-case-plantuml" aria-label="Mã PlantUML — có thể chỉnh sửa" value={draftCode} onChange={(event) => setDraftCode(event.target.value)} rows={12} disabled={busy || !imageCode} spellCheck={false} className="uml-code-panel min-h-[220px] max-h-[min(50vh,460px)] w-full resize-y overflow-auto border-0 p-3 font-mono text-xs leading-5 text-emerald-100 outline-none" />
          {imageCode && onSave && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-3 py-2"><PrimaryButton disabled={busy || !hasCodeChanges || !draftCode.trim()} onClick={() => onSave(draftCode)}>{busy ? "Đang lưu..." : "Lưu mã và render lại"}</PrimaryButton></div>}
        </section>
        <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">Ảnh biểu đồ</div>
          <div className="min-h-[320px] max-h-[min(72vh,700px)] overflow-auto bg-slate-50 p-3">
            {imageUrl ? <div className="flex min-h-[300px] min-w-full items-start justify-center"><img src={imageUrl} alt="Biểu đồ Use Case" draggable={false} style={{ width: (zoom * 100) + "%", minWidth: Math.min(zoom * 100, 100) + "%", maxWidth: "none", height: "auto" }} className="h-auto rounded-md object-contain shadow-sm" /></div> : <div className="flex min-h-[300px] items-center justify-center text-sm text-slate-500">Chưa có ảnh biểu đồ. Bấm “Sinh biểu đồ” để tạo.</div>}
          </div>
        </section>
        <div className="flex justify-end border-t border-slate-100 pt-3"><PrimaryButton disabled={busy || !imageUrl || !imageCode} onClick={onConfirm}>{confirmed ? "Đã xác nhận" : "Xác nhận biểu đồ"}</PrimaryButton></div>
      </Card>
    </div>
  );
}
