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
    <div className="pb-16">
      <Card compact allowOverflow className="!p-3">
        <div className="mb-3 flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-slate-200 pb-3">
          <PrimaryButton disabled={busy || !projectId} onClick={onRegenerate}>{busy ? "Đang sinh..." : imageCode ? "↻ Sinh lại biểu đồ" : "Sinh biểu đồ"}</PrimaryButton>
          <SoftButton disabled={!imageUrl} onClick={downloadImage}>↓ Tải ảnh về</SoftButton>
          <SoftButton disabled={!imageCode} onClick={() => setShowCode(true)}>Mã UML</SoftButton>
          <span className="mx-1 h-6 border-l border-slate-200" />
          <SoftButton disabled={!imageUrl || zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))}>−</SoftButton>
          <span className="min-w-12 text-center text-sm tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
          <SoftButton disabled={!imageUrl || zoom >= 2.5} onClick={() => setZoom((value) => Math.min(2.5, Number((value + 0.25).toFixed(2))))}>+</SoftButton>
          <SoftButton disabled={!imageUrl || zoom === 1} onClick={() => setZoom(1)}>Vừa khung</SoftButton>
          <div className="ml-auto">
            <PrimaryButton disabled={busy || !imageUrl || !imageCode} onClick={onConfirm}>{confirmed ? "✓ Đã lưu biểu đồ" : "Lưu biểu đồ"}</PrimaryButton>
          </div>
        </div>

        <div className={`grid min-w-0 items-start gap-3 ${showCode ? "grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]" : "grid-cols-1"}`}>
          <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

            <div className="flex h-[min(68vh,760px)] min-h-[360px] items-center justify-center overflow-auto bg-slate-50 p-3 sm:p-4">
              {imageUrl ? <div className="flex min-h-full w-full min-w-0 items-center justify-center"><img src={imageUrl} alt="Biểu đồ Use Case" draggable={false} style={{ width: `${zoom * 100}%`, height: "auto", maxWidth: "none", flexShrink: 0 }} className="rounded-md bg-white object-contain shadow-sm" /></div> : <div className="flex min-h-[360px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 text-center"><p className="text-sm text-slate-500">Chưa có biểu đồ</p><div className="mt-3"><PrimaryButton disabled={busy || !projectId} onClick={onRegenerate}>{busy ? "Đang sinh..." : "Sinh biểu đồ"}</PrimaryButton></div></div>}
            </div>
          </section>

          {showCode && <section className="flex h-[min(68vh,760px)] min-h-[360px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
              <PrimaryButton disabled={busy || !projectId} onClick={onRegenerate}>{busy ? "Đang sinh..." : "↻ Sinh lại"}</PrimaryButton>
              <PrimaryButton disabled={busy || !imageUrl || !imageCode} onClick={onConfirm}>{confirmed ? "✓ Đã lưu" : "Lưu biểu đồ"}</PrimaryButton>
            </div>
            <div className="min-h-0 flex-1 bg-[#102d24] p-3">
              <textarea id="use-case-plantuml" aria-label="Mã PlantUML — có thể chỉnh sửa" value={draftCode} onChange={(event) => setDraftCode(event.target.value)} disabled={busy || !imageCode} spellCheck={false} className="uml-code-panel block h-full min-h-0 w-full resize-none overflow-auto border-0 bg-transparent p-2 font-mono text-xs leading-5 text-emerald-100 outline-none focus:ring-0" />
            </div>
            {imageCode && onSave && <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white p-3">
              {hasCodeChanges && <span className="text-xs text-amber-700">Có thay đổi chưa lưu</span>}
              <PrimaryButton disabled={busy || !hasCodeChanges || !draftCode.trim()} onClick={() => onSave(draftCode)}>{busy ? "Đang lưu..." : "Lưu mã và render lại"}</PrimaryButton>
            </div>}
          </section>}
        </div>
      </Card>
      <div aria-hidden="true" className="h-6 min-h-6" />
    </div>
  );
}
