import { Card, SoftButton, PrimaryButton, EmptyState, Notice, StatusBadge } from "../../../common/ui/primitives";

interface Props {
  projectId: number;
  srsLoaded: boolean;
  srsMarkdown: string;
  srsSynced: boolean;
  busy: boolean;
  onSyncSrs: () => Promise<void>;
  onConsistencyCheck: () => Promise<void>;
  onCreateBaseline: () => Promise<void>;
  onApproveBaseline: () => Promise<void>;
  onExportSrs: () => Promise<void>;
  baselines: any[];
  selectedBaselineId: number | null;
  setSelectedBaselineId: (id: number | null) => void;
  consistencyResult: any;
  stage3Message: string;
  setStage3Message: (msg: string) => void;
}

export default function Step1DongBoSRS({
  projectId,
  srsLoaded,
  srsMarkdown,
  srsSynced,
  busy,
  onSyncSrs,
  onConsistencyCheck,
  onCreateBaseline,
  onApproveBaseline,
  onExportSrs,
  baselines,
  selectedBaselineId,
  setSelectedBaselineId,
  consistencyResult,
  stage3Message,
  setStage3Message,
}: Props) {
  return (
    <div className="space-y-6">
      <Card tone="emerald" title="Đồng bộ SRS và quản lý baseline">
        <div className="flex flex-wrap gap-3">
          <SoftButton disabled={busy} onClick={onSyncSrs}>
            1. Tải / đồng bộ SRS
          </SoftButton>

          <SoftButton disabled={busy} onClick={onConsistencyCheck}>
            2. Kiểm tra nhất quán UML
          </SoftButton>

          <SoftButton
            disabled={busy || !consistencyResult?.consistent}
            onClick={onCreateBaseline}
          >
            3. Tạo baseline
          </SoftButton>

          <SoftButton
            disabled={busy || selectedBaselineId === null}
            onClick={onApproveBaseline}
          >
            4. Duyệt baseline
          </SoftButton>

          <PrimaryButton
            disabled={busy || !baselines.some((item) => item.status === "approved")}
            onClick={onExportSrs}
          >
            Xuất SRS chính thức
          </PrimaryButton>
        </div>

        {stage3Message && (
          <Notice tone="info">{stage3Message}</Notice>
        )}

        <div className="mt-4 space-y-2 text-sm">
          <p>
            SRS:{" "}
            <StatusBadge tone={srsLoaded ? "success" : "neutral"}>
              {srsLoaded ? "Đã tải" : "Chưa tải"}
            </StatusBadge>
          </p>

          <p>
            Kiểm tra UML:{" "}
            <StatusBadge
              tone={
                consistencyResult?.consistent
                  ? "success"
                  : consistencyResult
                    ? "danger"
                    : "neutral"
              }
            >
              {consistencyResult
                ? consistencyResult.consistent
                  ? "Không phát hiện sai lệch trong phạm vi kiểm tra"
                  : "Có sai lệch"
                : "Chưa kiểm tra"}
            </StatusBadge>
          </p>

          {consistencyResult && !consistencyResult.consistent && (
            <ul className="list-disc space-y-1 pl-5">
              {consistencyResult.missing_in_database.map((item: string, index: number) => (
                <li key={`db-${index}`}>
                  Thiếu trong dữ liệu đã lưu: {item}
                </li>
              ))}
              {consistencyResult.missing_in_plantuml.map((item: string, index: number) => (
                <li key={`puml-${index}`}>
                  Thiếu trong PlantUML: {item}
                </li>
              ))}
              {consistencyResult.missing_relations.map((item: any, index: number) => (
                <li key={`mr-${index}`}>
                  Thiếu quan hệ: {item.from} → {item.to} ({item.type})
                </li>
              ))}
              {consistencyResult.extra_relations.map((item: any, index: number) => (
                <li key={`er-${index}`}>
                  Quan hệ thừa: {item.from} → {item.to} ({item.type})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold text-slate-700 mb-2">Baseline của dự án</div>

          {baselines.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có baseline.</p>
          ) : (
            <div className="space-y-2">
              {baselines.map((baseline) => (
                <label
                  key={baseline.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <input
                    type="radio"
                    name="project-baseline"
                    checked={selectedBaselineId === baseline.id}
                    onChange={() => setSelectedBaselineId(baseline.id)}
                  />
                  <span className="text-sm">
                    Phiên bản {baseline.version} — {baseline.name}
                    {" · "}
                    {baseline.status === "approved" ? "Đã duyệt" : "Bản nháp"}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {srsLoaded && (
          <details className="mt-4">
            <summary className="cursor-pointer font-medium text-sm">
              Xem nội dung SRS đã tải
            </summary>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs">
              {srsMarkdown || "Tài liệu chưa có nội dung Markdown."}
            </pre>
          </details>
        )}
      </Card>
    </div>
  );
}
