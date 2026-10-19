import type { ReactNode } from "react";
import { Card, SoftButton, PrimaryButton, EmptyState, StatusBadge, wrapClass } from "../../../common/ui/primitives";
import type {
  RequirementAnalysis,
  RequirementRecord,
} from "../../../../services/requirementService";
import type { RawRequirement } from "../../../../types/workflow";

interface Props {
  projectId?: number;
  requirements: RequirementRecord[];
  requirementValues: Record<number, RawRequirement>;
  analyses: Record<number, RequirementAnalysis>;
  loadingAnalysis: boolean;
  busy: boolean;
  loaded: boolean;
  error: string;
  runBatchAnalysis: () => void | Promise<void>;
  onStepChange: (step: number) => void;
  requirementTitle: (raw: RawRequirement) => string;
  wrapClass: string;
}

type BadgeTone = "success" | "warn" | "muted";

const BADGE_COLORS: Record<BadgeTone, string> = {
  success: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-800",
  muted: "bg-slate-100 text-slate-600",
};

function StatusBadgeLocal({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE_COLORS[tone]}`}>
      {children}
    </span>
  );
}

function Metric({ label, value, detail, tone = "neutral" }: {
  label: string;
  value: number;
  detail: string;
  tone?: "neutral" | "success" | "warn";
}) {
  const styles = {
    neutral: "border-slate-200 bg-white text-slate-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <div className={`rounded-xl border p-4 ${styles[tone]}`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs opacity-75">{detail}</p>
    </div>
  );
}

export default function Step2PhanTichYeuCau({
  requirements,
  requirementValues,
  analyses,
  loadingAnalysis,
  busy,
  runBatchAnalysis,
  onStepChange,
  requirementTitle,
  wrapClass: inheritedWrapClass,
}: Props) {
  const draftRequirements = requirements.filter((item) => item.status === "draft");
  const completeCount = draftRequirements.filter((item) => analyses[item.id]?.is_complete).length;
  const analyzedCount = draftRequirements.filter((item) => Boolean(analyses[item.id])).length;
  const missingCount = analyzedCount - completeCount;
  const pendingCount = draftRequirements.length - analyzedCount;
  const canContinue = !busy && !loadingAnalysis;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Yêu cầu cần rà soát" value={draftRequirements.length} detail="Các yêu cầu bản nháp" />
        <Metric label="Đã phân tích" value={analyzedCount} detail={draftRequirements.length ? `${Math.round((analyzedCount / draftRequirements.length) * 100)}% số yêu cầu` : "Chưa có dữ liệu"} />
        <Metric label="Đủ thông tin" value={completeCount} detail="Có thể xem xét xác nhận" tone="success" />
        <Metric label="Cần bổ sung" value={missingCount + pendingCount} detail={pendingCount ? `${pendingCount} chưa có kết quả` : "Theo kết quả phân tích"} tone={missingCount + pendingCount ? "warn" : "success"} />
      </div>

      <Card tone="emerald" title="Kết quả phân tích" subtitle="AI kiểm tra mức độ đầy đủ của từng yêu cầu. Hãy xem lại gợi ý và điều chỉnh nội dung ở Bước 1 khi cần." actions={
        <SoftButton disabled={busy || loadingAnalysis || draftRequirements.length === 0} onClick={() => void runBatchAnalysis()}>
          {loadingAnalysis ? "Đang phân tích..." : analyzedCount ? "Phân tích lại" : "Phân tích bằng AI"}
        </SoftButton>
      }>
        {loadingAnalysis ? (
          <div role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 animate-pulse items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">✦</span>
              <div><p className="text-sm font-semibold text-emerald-900">AI đang rà soát yêu cầu</p><p className="mt-1 text-sm text-emerald-800">Đang phân tích {draftRequirements.length} yêu cầu. Kết quả sẽ xuất hiện tại từng mục sau khi hoàn tất.</p></div>
            </div>
          </div>
        ) : draftRequirements.length === 0 ? (
          <EmptyState title="Không có yêu cầu bản nháp" hint="Quay lại Bước 1 để thêm yêu cầu cần phân tích, hoặc tiếp tục sang Bước 3 nếu danh sách đã sẵn sàng." />
        ) : (
          <div className="space-y-3">
            {draftRequirements.map((item, index) => {
              const analysis = analyses[item.id];
              const rawValue = requirementValues[item.id];
              const title = rawValue ? requirementTitle(rawValue) : `Yêu cầu ${item.id}`;
              return (
                <article key={item.id} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-emerald-200">
                  <div className="flex min-w-0 items-start gap-3 p-4 sm:p-5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className={`min-w-0 flex-1 break-words text-sm font-semibold leading-6 text-slate-900 ${inheritedWrapClass || wrapClass}`}>{title}</h3>
                        {analysis ? (
                          <StatusBadge tone={analysis.is_complete ? "success" : "warn"}>{analysis.is_complete ? "Đủ thông tin" : "Cần bổ sung"}</StatusBadge>
                        ) : <StatusBadgeLocal tone="muted">Chưa phân tích</StatusBadgeLocal>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Mã yêu cầu: REQ-{String(item.id).padStart(3, "0")}</p>
                    </div>
                  </div>
                  {analysis ? (
                    <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
                      {!analysis.is_complete && analysis.missing_elements.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:p-4">
                          <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Thông tin còn thiếu</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950">
                            {analysis.missing_elements.map((element, missingIndex) => <li key={`${missingIndex}-${element}`}>{element}</li>)}
                          </ul>
                        </div>
                      )}
                      <div className={`mt-3 rounded-lg p-3 text-sm leading-6 ${analysis.is_complete ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-700"} ${inheritedWrapClass || wrapClass}`}>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-75">{analysis.is_complete ? "Nhận xét của AI" : "Gợi ý hoàn thiện"}</p>
                        {analysis.feedback || (analysis.is_complete ? "Yêu cầu có đủ thông tin để tiếp tục." : "Hãy bổ sung các thông tin còn thiếu rồi phân tích lại.")}
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
                      <p className="text-sm text-slate-600">Chưa có kết quả cho yêu cầu này. Chọn “Phân tích bằng AI” để kiểm tra tính đầy đủ.</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-xs leading-5 text-slate-500 ${inheritedWrapClass || wrapClass}`}>Kết quả AI là gợi ý rà soát; hãy kiểm tra nội dung nghiệp vụ trước khi xác nhận yêu cầu.</p>
          
        </div>
      </Card>
    </div>
  );
}
