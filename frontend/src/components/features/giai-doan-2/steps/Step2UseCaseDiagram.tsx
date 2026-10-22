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
    <div className="space-y-3">
      <Card compact allowOverflow>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <PrimaryButton disabled={busy || !projectId} onClick={onRegenerate}>{busy ? "Đang sinh..." : imageCode ? "↻ Sinh lại biểu đồ" : "Sinh biểu đồ"}</PrimaryButton>
              <SoftButton disabled={!imageUrl} onClick={downloadImage}>↓ Tải ảnh về</SoftButton>
              <SoftButton disabled={!imageCode} onClick={() => setShowCode((value) => !value)}>{showCode ? "Ẩn mã PlantUML" : "Mở mã PlantUML"}</SoftButton>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium uppercase tracking-wide text-slate-500">Thu phóng</span>
              <SoftButton disabled={!imageUrl || zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))}>−</SoftButton>
              <span className="min-w-12 text-center text-sm tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
              <SoftButton disabled={!imageUrl || zoom >= 2.5} onClick={() => setZoom((value) => Math.min(2.5, Number((value + 0.25).toFixed(2))))}>+</SoftButton>
              <SoftButton disabled={!imageUrl || zoom === 1} onClick={() => setZoom(1)}>Vừa khung</SoftButton>
              <div className="mx-1 hidden h-7 border-l border-slate-300 sm:block" />
              <PrimaryButton disabled={busy || !imageUrl || !imageCode} onClick={onConfirm}>{confirmed ? "✓ Đã lưu biểu đồ" : "Lưu biểu đồ"}</PrimaryButton>
            </div>
          </div>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Không gian biểu đồ Use Case</h3>
                <p className="mt-0.5 text-xs text-slate-500">{imageUrl ? "Xem và kiểm tra sơ đồ trước khi lưu." : "Sinh biểu đồ để bắt đầu xem và chỉnh sửa."}</p>
              </div>
              {imageUrl && <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">Mức zoom {Math.round(zoom * 100)}%</span>}
            </div>
            <div className="max-h-[min(72vh,900px)] min-h-[520px] overflow-auto bg-slate-100 p-4 sm:p-6">
              {imageUrl ? <div className="flex min-h-[480px] min-w-full items-start justify-center"><img src={imageUrl} alt="Biểu đồ Use Case" draggable={false} style={{ width: (zoom * 100) + "%", minWidth: Math.min(zoom * 100, 100) + "%", maxWidth: "none", height: "auto" }} className="h-auto rounded-lg bg-white object-contain shadow-md" /></div> : <div className="flex min-h-[480px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-500">◇</div>
                <p className="text-sm font-semibold text-slate-700">Chưa có biểu đồ</p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">Nhấn “Sinh biểu đồ” để tạo sơ đồ Use Case từ dữ liệu hiện tại.</p>
                <div className="mt-4"><PrimaryButton disabled={busy || !projectId} onClick={onRegenerate}>{busy ? "Đang sinh..." : "Sinh biểu đồ"}</PrimaryButton></div>
              </div>}
            </div>
          </section>

          {showCode && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div><h3 className="text-sm font-semibold text-slate-800">Mã nguồn PlantUML</h3><p className="mt-0.5 text-xs text-slate-500">Chỉnh sửa mã rồi lưu để dựng lại biểu đồ.</p></div>
              <button type="button" onClick={() => setShowCode(false)} className="rounded-lg px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800">Đóng ×</button>
            </div>
            <div className="bg-[#102d24] p-3 sm:p-4">
              <textarea id="use-case-plantuml" aria-label="Mã PlantUML — có thể chỉnh sửa" value={draftCode} onChange={(event) => setDraftCode(event.target.value)} rows={16} disabled={busy || !imageCode} spellCheck={false} className="uml-code-panel min-h-[280px] w-full resize-y overflow-auto rounded-lg border border-white/10 bg-transparent p-4 font-mono text-xs leading-5 text-emerald-100 outline-none focus:ring-1 focus:ring-emerald-400" />
            </div>
            {imageCode && onSave && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
              <span className={`text-xs ${hasCodeChanges ? "text-amber-700" : "text-slate-500"}`}>{hasCodeChanges ? "Mã có thay đổi chưa lưu" : "Mã đã đồng bộ"}</span>
              <PrimaryButton disabled={busy || !hasCodeChanges || !draftCode.trim()} onClick={() => onSave(draftCode)}>{busy ? "Đang lưu..." : "Lưu mã và render lại"}</PrimaryButton>
            </div>}
          </section>}
        </div>
      </Card>
    </div>
  );
}