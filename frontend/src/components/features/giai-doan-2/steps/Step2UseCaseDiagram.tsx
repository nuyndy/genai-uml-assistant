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

  const downloadImage = () => {
    if (!imageUrl) return;
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "use-case-diagram." + imageExtension(imageUrl);
    link.target = "_blank";
    link.rel = "noreferrer";
    link.click();
  };

  return (
    <div>
      <Card compact allowOverflow className="!p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-sky-100 text-lg text-sky-800">◎</span>
              <h2 className="text-base font-semibold text-slate-900">Biểu đồ Use Case</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${imageUrl ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{imageUrl ? "Đã tạo biểu đồ" : "Chưa có biểu đồ"}</span>
            </div>
            <p className="mt-1.5 text-sm text-slate-500">Sinh biểu đồ từ các tác nhân và Use Case, sau đó xem, chỉnh sửa mã hoặc lưu kết quả.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PrimaryButton disabled={busy || !projectId} onClick={onRegenerate}>{busy ? "Đang sinh..." : imageCode ? "↻ Sinh lại biểu đồ" : "Sinh biểu đồ"}</PrimaryButton>
            <SoftButton disabled={!imageUrl} onClick={downloadImage}>↓ Tải ảnh về</SoftButton>
            <SoftButton disabled={!imageCode} onClick={() => setShowCode((value) => !value)}>{showCode ? "Ẩn mã UML" : "Mã UML"}</SoftButton>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <span className="text-xs font-medium text-slate-500">CÔNG CỤ XEM BIỂU ĐỒ</span>
          <div className="flex flex-wrap items-center gap-2">
            <SoftButton disabled={!imageUrl || zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))}>−</SoftButton>
            <span className="min-w-12 text-center text-sm tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
            <SoftButton disabled={!imageUrl || zoom >= 2.5} onClick={() => setZoom((value) => Math.min(2.5, Number((value + 0.25).toFixed(2))))}>+</SoftButton>
            <SoftButton disabled={!imageUrl || zoom === 1} onClick={() => setZoom(1)}>Vừa khung</SoftButton>
            <PrimaryButton disabled={busy || !imageUrl || !imageCode} onClick={onConfirm}>{confirmed ? "✓ Đã lưu biểu đồ" : "Lưu biểu đồ"}</PrimaryButton>
          </div>
        </div>

        <div className={`mt-3 grid min-w-0 items-stretch gap-3 ${showCode ? "grid-cols-1 lg:grid-cols-[minmax(280px,34%)_minmax(0,1fr)]" : "grid-cols-1"}`}>
          {showCode && <section className="flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2"><span className="text-sm font-semibold text-slate-700">Mã UML</span><button type="button" onClick={() => setShowCode(false)} aria-label="Đóng mã UML" className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100">×</button></div>
            <div className="min-h-0 flex-1 bg-[#102d24] p-3">
              <textarea id="use-case-plantuml" aria-label="Mã PlantUML — có thể chỉnh sửa" value={draftCode} onChange={(event) => setDraftCode(event.target.value)} disabled={busy || !imageCode} spellCheck={false} className="uml-code-panel h-full min-h-[440px] w-full resize-y overflow-auto border-0 bg-transparent p-2 font-mono text-xs leading-5 text-emerald-100 outline-none focus:ring-0" />
            </div>
            {imageCode && onSave && <div className="flex flex-col gap-2 border-t border-slate-200 p-3">
              {hasCodeChanges && <span className="text-xs text-amber-700">Có thay đổi chưa lưu</span>}
              <PrimaryButton disabled={busy || !hasCodeChanges || !draftCode.trim()} onClick={() => onSave(draftCode)}>{busy ? "Đang lưu..." : "Lưu mã và render lại"}</PrimaryButton>
            </div>}
          </section>}

          <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="max-h-[min(78vh,1000px)] min-h-[560px] overflow-auto bg-slate-50 p-3 sm:p-5">
              {imageUrl ? <div className="flex min-h-[520px] min-w-full items-start justify-center"><img src={imageUrl} alt="Biểu đồ Use Case" draggable={false} style={{ width: (zoom * 100) + "%", minWidth: Math.min(zoom * 100, 100) + "%", maxWidth: "none", height: "auto" }} className="h-auto rounded-md bg-white object-contain shadow-sm" /></div> : <div className="flex min-h-[520px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 text-center"><p className="text-sm text-slate-500">Chưa có biểu đồ</p><div className="mt-3"><PrimaryButton disabled={busy || !projectId} onClick={onRegenerate}>{busy ? "Đang sinh..." : "Sinh biểu đồ"}</PrimaryButton></div></div>}
            </div>
          </section>
        </div>
      </Card>
    </div>
  );
}