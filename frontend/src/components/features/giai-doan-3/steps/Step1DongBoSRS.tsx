import { Card, SoftButton, Notice, StatusBadge } from "../../../common/ui/primitives";

interface Props {
  srsLoaded: boolean;
  srsMarkdown: string;
  srsSynced: boolean;
  busy: boolean;
  onSyncSrs: () => Promise<void>;
  stage3Message: string;
}

export default function Step1DongBoSRS({
  srsLoaded,
  srsMarkdown,
  srsSynced,
  busy,
  onSyncSrs,
  stage3Message,
}: Props) {
  return (
    <div className="space-y-6">
      <Card tone="emerald" title="Hoàn thiện tài liệu SRS">
        <p className="mb-4 text-sm text-slate-600">
          Tải tài liệu SRS hiện có từ backend để rà soát và hoàn thiện sau khi đã quét, xử lý sai lệch UML.
        </p>
        <SoftButton disabled={busy} onClick={onSyncSrs}>
          {busy ? "Đang đồng bộ..." : "Tải tài liệu SRS"}
        </SoftButton>
        {stage3Message && <Notice tone="info">{stage3Message}</Notice>}
        <div className="mt-4 space-y-2 text-sm">
          <p>
            Trạng thái đồng bộ:{" "}
            <StatusBadge tone={srsSynced && srsLoaded ? "success" : "info"}>
              {srsSynced && srsLoaded ? "Đã đồng bộ" : "Chưa đồng bộ"}
            </StatusBadge>
          </p>
          <p>
            Tài liệu SRS:{" "}
            <StatusBadge tone={srsLoaded ? "success" : "muted"}>
              {srsLoaded ? "Đã tải" : "Chưa tải"}
            </StatusBadge>
          </p>
        </div>
        {srsLoaded && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">Xem nội dung SRS</summary>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs">
              {srsMarkdown || "Tài liệu chưa có nội dung Markdown."}
            </pre>
          </details>
        )}
      </Card>
    </div>
  );
}
