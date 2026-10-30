import { useMemo, useState } from "react";
import { Card, PrimaryButton, SoftButton, Notice } from "../../../common/ui/primitives";
import type { BaselineIssueDecision, ProjectBaseline } from "../../../common/services/umlService";

interface Props {
  baselines: ProjectBaseline[];
  issues: BaselineIssueDecision[];
  busy: boolean;
  hasChecked: boolean;
  message: string;
  onIssuesChange: (issues: BaselineIssueDecision[]) => void;
  onCreate: (name: string, issues: BaselineIssueDecision[]) => Promise<void>;
  onSaveIssues: (baselineId: number, issues: BaselineIssueDecision[]) => Promise<void>;
  onApprove: (baselineId: number) => Promise<void>;
  onExport: (baselineId: number) => Promise<void>;
}

export default function Step4Baseline({
  baselines, issues, busy, hasChecked, message, onIssuesChange, onCreate, onSaveIssues, onApprove, onExport,
}: Props) {
  const [name, setName] = useState("");
  const [selectedBaselineId, setSelectedBaselineId] = useState<number | null>(null);
  const unresolved = useMemo(() => issues.filter((item) => item.status === "open").length, [issues]);
  const accepted = issues.length - unresolved;

  return (
    <div className="space-y-4 pb-4">
      <Card tone="emerald">
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Rà soát sai lệch và chốt baseline</h2>
            <p className="mt-1 text-sm text-slate-600">Mỗi sai lệch cần được xử lý hoặc BA chấp nhận/miễn trừ kèm lý do. Snapshot baseline được giữ nguyên sau khi tạo.</p>
          </div>
          {message && <Notice tone="info">{message}</Notice>}
          {!hasChecked ? (
            <Notice tone="info">Hãy hoàn tất kiểm tra nhất quán ở Bước 3 trước khi tạo baseline.</Notice>
          ) : issues.length === 0 ? (
            <Notice tone="success">Chưa có sai lệch từ lần kiểm tra gần nhất. Hãy kiểm tra nhất quán ở Bước 3 trước khi tạo baseline.</Notice>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="font-medium text-slate-700">{issues.length} sai lệch</span>
                <span className="text-amber-700">{unresolved} chưa xử lý</span>
                <span className="text-emerald-700">{accepted} đã chấp nhận/miễn trừ</span>
              </div>
              {issues.map((issue, index) => (
                <div key={String(issue.id ?? issue.type) + index} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-800">{String(issue.title ?? issue.type ?? "Sai lệch")}</p>
                  <p className="mt-1 break-words text-sm text-slate-600">{String(issue.detail ?? issue.message ?? "")}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)]">
                    <select
                      aria-label={`Quyết định sai lệch ${index + 1}`}
                      value={issue.status}
                      disabled={busy}
                      onChange={(event) => onIssuesChange(issues.map((item, i) => i === index ? { ...item, status: event.target.value as BaselineIssueDecision["status"] } : item))}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="open">Chưa xử lý</option>
                      <option value="accepted">BA chấp nhận</option>
                      <option value="waived">Miễn trừ có lý do</option>
                    </select>
                    <input
                      aria-label={`Lý do chấp nhận sai lệch ${index + 1}`}
                      value={issue.acceptance_reason ?? ""}
                      disabled={busy || issue.status === "open"}
                      onChange={(event) => onIssuesChange(issues.map((item, i) => i === index ? { ...item, acceptance_reason: event.target.value } : item))}
                      placeholder="Nhập lý do bắt buộc khi chấp nhận/miễn trừ"
                      className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tên baseline (ví dụ: Phiên bản bàn giao 1)" className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <PrimaryButton disabled={busy || !hasChecked || issues.some((item) => item.status !== "open" && !item.acceptance_reason?.trim())} onClick={() => void onCreate(name.trim() || "Baseline bàn giao", issues)}>
              {busy ? "Đang tạo..." : "Tạo baseline nháp"}
            </PrimaryButton>
          </div>
        </div>
      </Card>
      <Card>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Lịch sử baseline</h3>
          {baselines.length === 0 ? <p className="text-sm text-slate-500">Chưa có baseline nào.</p> : baselines.map((baseline) => (
            <div key={baseline.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{baseline.name} · v{baseline.version}</p>
                <p className="text-xs text-slate-500">Trạng thái: {baseline.status} · {baseline.open_issues?.length ?? 0} sai lệch</p>
              </div>
              {baseline.status === "approved" && (
                <SoftButton disabled={busy} onClick={() => void onExport(baseline.id)}>
                  Xuất SRS DOCX
                </SoftButton>
              )}
              {baseline.status === "draft" && (
                <div className="flex flex-wrap gap-2">
                  <SoftButton
                    disabled={busy}
                    onClick={() => {
                      setSelectedBaselineId(baseline.id);
                      onIssuesChange((baseline.open_issues ?? []) as BaselineIssueDecision[]);
                    }}
                  >
                    Chỉnh quyết định
                  </SoftButton>
                  <SoftButton
                    disabled={busy || (baseline.open_issues ?? []).some((item: any) => item.status === "open" || ((item.status === "accepted" || item.status === "waived") && !String(item.acceptance_reason ?? item.reason ?? "").trim()))}
                    onClick={() => void onApprove(baseline.id)}
                  >
                    Duyệt baseline
                  </SoftButton>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
      {selectedBaselineId !== null && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Cập nhật quyết định baseline nháp</h3>
              <p className="text-xs text-slate-500">Chỉ cập nhật trạng thái và lý do; snapshot dữ liệu không thay đổi.</p>
            </div>
            <div className="flex gap-2">
              <SoftButton disabled={busy} onClick={() => setSelectedBaselineId(null)}>Hủy</SoftButton>
              <PrimaryButton
                disabled={busy || issues.some((item) => item.status !== "open" && !item.acceptance_reason?.trim())}
                onClick={() => void onSaveIssues(selectedBaselineId, issues)}
              >
                Lưu quyết định
              </PrimaryButton>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
