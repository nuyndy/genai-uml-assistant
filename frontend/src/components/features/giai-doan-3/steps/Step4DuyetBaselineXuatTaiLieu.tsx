import type { ExportFormat } from "../../../../types/workflow";
import { Card, SegmentedControl, SoftButton, Notice, PrimaryButton, StatusBadge } from "../../../common/ui/primitives";

interface Props {
  state: {
    exportFormat: string;
    previewImageUrl: string | null;
    embeddedDiagrams: { name: string; imageUrl: string }[];
  };
  busy: boolean;
  onAttachDiagram: () => Promise<void>;
  onExportFormatChange: (format: ExportFormat) => void;
  baselines: any[];
  selectedBaselineId: number | null;
  setSelectedBaselineId: (id: number | null) => void;
  consistencyResult: any;
  onCreateBaseline: () => Promise<void>;
  onApproveBaseline: () => Promise<void>;
  onExportSrs: () => Promise<void>;
  onStepChange: (step: number) => void;
}

export default function Step4DuyetBaselineXuatTaiLieu({
  state,
  busy,
  onAttachDiagram,
  onExportFormatChange,
  baselines,
  selectedBaselineId,
  setSelectedBaselineId,
  consistencyResult,
  onCreateBaseline,
  onApproveBaseline,
  onExportSrs,
}: Props) {
  return (
    <div className="space-y-6">
      <Card tone="emerald" title="Định dạng xuất">
        <SegmentedControl<string>
          value={state.exportFormat}
          onChange={(format) => onExportFormatChange(format as ExportFormat)}
          options={[
            { value: "png", label: "PNG" },
            { value: "svg", label: "SVG" },
          ]}
        />
      </Card>

      {state.previewImageUrl ? (
        <div className="relative min-h-[400px] flex items-center justify-center border rounded-xl bg-slate-50 overflow-hidden">
           <img
              src={state.previewImageUrl}
              alt="Final Diagram"
              className="max-w-full h-auto"
            />
        </div>
      ) : (
        <Notice tone="warn">
          Chưa có ảnh biểu đồ để xuất. Hãy quay lại Bước 3 để render trước khi xuất.
        </Notice>
      )}

      <Card
        tone="emerald"
        title="Xuất kết quả"
        actions={
          state.embeddedDiagrams.length > 0 ? (
            <div className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-medium">
              Đã chèn {state.embeddedDiagrams.length} biểu đồ
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-wrap gap-3">
          {state.previewImageUrl && (
            <a
              href={state.previewImageUrl}
              download={`diagram.${state.exportFormat}`}
              className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md"
            >
              ⬇ Xuất file ảnh (.{state.exportFormat})
            </a>
          )}

          <SoftButton
            disabled={!state.previewImageUrl || busy}
            onClick={onAttachDiagram}
          >
            Chèn vào tài liệu đặc tả hệ thống
          </SoftButton>
        </div>

        {!state.previewImageUrl && (
          <p className="mt-3 text-xs text-slate-500">
            Nút xuất sẽ khả dụng sau khi có ảnh ở Bước 3.
          </p>
        )}

        <div className="mt-4 p-3 rounded-lg bg-slate-100 text-[10px] font-mono text-slate-500">
          Endpoint: POST /diagram/export và POST /specs/attach-diagram
        </div>
      </Card>


      <Card tone="emerald" title="Duyệt baseline và xuất SRS">
        <div className="mb-4 flex flex-wrap gap-3">
          <SoftButton
            disabled={busy || !consistencyResult?.consistent}
            onClick={onCreateBaseline}
          >
            Tạo baseline
          </SoftButton>
          <SoftButton
            disabled={busy || selectedBaselineId === null || !consistencyResult?.consistent}
            onClick={onApproveBaseline}
          >
            Duyệt baseline
          </SoftButton>
          <PrimaryButton
            disabled={busy || !baselines.some((item) => item.status === "approved")}
            onClick={onExportSrs}
          >
            Xuất SRS chính thức (DOCX)
          </PrimaryButton>
        </div>
        <div className="space-y-2">
          {baselines.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có baseline. Hãy kiểm tra nhất quán trước khi tạo.</p>
          ) : baselines.map((baseline) => (
            <label key={baseline.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3">
              <input
                type="radio"
                name="project-baseline"
                checked={selectedBaselineId === baseline.id}
                onChange={() => setSelectedBaselineId(baseline.id)}
              />
              <span className="flex-1 text-sm">Phiên bản {baseline.version} — {baseline.name}</span>
              <StatusBadge tone={baseline.status === "approved" ? "success" : "info"}>
                {baseline.status === "approved" ? "Đã duyệt" : "Bản nháp"}
              </StatusBadge>
            </label>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap justify-between gap-3">
        
      </div>
    </div>
  );
}
