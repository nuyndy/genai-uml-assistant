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
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    setDraftCode(imageCode ?? "");
  }, [imageCode]);

  const hasCodeChanges = draftCode.trim() !== (imageCode ?? "").trim();

  return (
    <div className="space-y-3">
      <Card compact allowOverflow>
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[148px_minmax(0,1fr)]">
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

        <section className="relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">◎</span>Sơ đồ Use Case</div>
            <div className="flex flex-wrap items-center gap-2">
              <SoftButton disabled={!imageUrl || zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))}>−</SoftButton>
              <span className="min-w-12 text-center text-xs font-semibold tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
              <SoftButton disabled={!imageUrl || zoom >= 2.5} onClick={() => setZoom((value) => Math.min(2.5, Number((value + 0.25).toFixed(2))))}>+</SoftButton>
              <SoftButton disabled={!imageUrl || zoom === 1} onClick={() => setZoom(1)}>Vừa khung</SoftButton>
              <SoftButton onClick={() => setShowCode((value) => !value)}>{showCode ? "Ẩn mã" : "Mã PlantUML"}</SoftButton>
            </div>
          </div>
          <div className="relative min-h-[520px] max-h-[min(78vh,900px)] overflow-auto bg-slate-50 p-4 sm:p-6">
            {imageUrl ? <div className="flex min-h-[480px] min-w-full items-start justify-center"><img src={imageUrl} alt="Biểu đồ Use Case" draggable={false} style={{ width: (zoom * 100) + "%", minWidth: Math.min(zoom * 100, 100) + "%", maxWidth: "none", height: "auto" }} className="h-auto rounded-lg bg-white object-contain shadow-md" /></div> : <div className="flex min-h-[480px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">Chưa có sơ đồ. Bấm “Sinh biểu đồ” để tạo.</div>}
            {showCode && <div className="absolute right-4 top-4 z-10 flex w-[min(420px,calc(100%-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-[#102d24] shadow-2xl">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2"><span className="text-sm font-semibold text-emerald-100">Mã PlantUML</span><button type="button" onClick={() => setShowCode(false)} aria-label="Đóng mã PlantUML" className="rounded-md px-2 py-1 text-emerald-100 hover:bg-white/10">×</button></div>
              <span className="px-3 pt-2 text-[11px] text-emerald-200/80">{hasCodeChanges ? "Có thay đổi chưa render" : "Đã đồng bộ với ảnh"}</span>
              <textarea id="use-case-plantuml" aria-label="Mã PlantUML — có thể chỉnh sửa" value={draftCode} onChange={(event) => setDraftCode(event.target.value)} rows={14} disabled={busy || !imageCode} spellCheck={false} className="uml-code-panel max-h-[min(48vh,520px)] min-h-[240px] w-full resize-y overflow-auto border-0 bg-transparent p-3 font-mono text-xs leading-5 text-emerald-100 outline-none focus:ring-0" />
              {imageCode && onSave && <div className="flex justify-end border-t border-white/10 px-3 py-2"><PrimaryButton disabled={busy || !hasCodeChanges || !draftCode.trim()} onClick={() => onSave(draftCode)}>{busy ? "Đang lưu..." : "Lưu mã và render lại"}</PrimaryButton></div>}
            </div>}
          </div>
        </section>
        </div>
        <div className="flex justify-end border-t border-slate-100 pt-4"><PrimaryButton disabled={busy || !imageUrl || !imageCode} onClick={onConfirm}>{confirmed ? "Đã xác nhận" : "Xác nhận biểu đồ"}</PrimaryButton></div>
      </Card>
    </div>
  );
}
