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
      <Card compact allowOverflow>
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[148px_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col items-stretch gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <SoftButton disabled={busy || !projectId} onClick={onRegenerate}>{busy ? "Đang sinh..." : imageCode ? "↻ Sinh lại biểu đồ" : "Sinh biểu đồ"}</SoftButton>
          <SoftButton disabled={!imageUrl} onClick={() => { if (!imageUrl) return; const link = document.createElement("a"); link.href = imageUrl; link.download = "use-case-diagram." + imageExtension(imageUrl); link.target = "_blank"; link.rel = "noreferrer"; link.click(); }}>↓ Tải ảnh về</SoftButton>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
            <SoftButton disabled={!imageUrl || zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))}>−</SoftButton>
            <span className="min-w-10 text-center text-xs tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
            <SoftButton disabled={!imageUrl || zoom >= 2.5} onClick={() => setZoom((value) => Math.min(2.5, Number((value + 0.25).toFixed(2))))}>+</SoftButton>
          </div>
          <SoftButton disabled={!imageUrl || zoom === 1} onClick={() => setZoom(1)}>Vừa khung</SoftButton>
        </div>

        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-[#102d24] shadow-sm">
          <div className="flex min-h-11 items-center justify-between gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-2"><span className="flex items-center gap-2 text-sm font-semibold text-emerald-100"><span className="rounded-md bg-emerald-400/15 px-2 py-1 text-[10px] tracking-wide text-emerald-200">CODE</span>Mã PlantUML</span><span className="text-[11px] text-emerald-200/80">{hasCodeChanges ? "Chưa render" : "Đã đồng bộ"}</span></div>
          <textarea id="use-case-plantuml" aria-label="Mã PlantUML — có thể chỉnh sửa" value={draftCode} onChange={(event) => setDraftCode(event.target.value)} rows={12} disabled={busy || !imageCode} spellCheck={false} className="uml-code-panel min-h-[320px] max-h-[min(68vh,700px)] w-full resize-y overflow-auto border-0 bg-transparent p-4 font-mono text-xs leading-5 text-emerald-100 outline-none focus:ring-0" />
          {imageCode && onSave && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-3 py-2"><PrimaryButton disabled={busy || !hasCodeChanges || !draftCode.trim()} onClick={() => onSave(draftCode)}>{busy ? "Đang lưu..." : "Lưu mã và render lại"}</PrimaryButton></div>}
        </section>
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex min-h-11 items-center gap-2 border-b border-slate-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] tracking-wide text-emerald-700">PREVIEW</span>Ảnh biểu đồ</div>
          <div className="min-h-[360px] max-h-[min(76vh,760px)] overflow-auto bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%),linear-gradient(-45deg,#f8fafc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f8fafc_75%),linear-gradient(-45deg,transparent_75%,#f8fafc_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] p-4">
            {imageUrl ? <div className="flex min-h-[300px] min-w-full items-start justify-center"><img src={imageUrl} alt="Biểu đồ Use Case" draggable={false} style={{ width: (zoom * 100) + "%", minWidth: Math.min(zoom * 100, 100) + "%", maxWidth: "none", height: "auto" }} className="h-auto rounded-md object-contain shadow-sm" /></div> : <div className="flex min-h-[300px] items-center justify-center text-sm text-slate-500">Chưa có ảnh biểu đồ. Bấm “Sinh biểu đồ” để tạo.</div>}
          </div>
        </section>
        </div>
        <div className="flex justify-end border-t border-slate-100 pt-4"><PrimaryButton disabled={busy || !imageUrl || !imageCode} onClick={onConfirm}>{confirmed ? "Đã xác nhận" : "Xác nhận biểu đồ"}</PrimaryButton></div>
      </Card>
    </div>
  );
}
