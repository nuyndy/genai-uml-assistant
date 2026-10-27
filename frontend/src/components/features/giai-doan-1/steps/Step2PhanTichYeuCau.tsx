import { Card, SoftButton, EmptyState } from "../../../common/ui/primitives";
import type { RequirementCoverageAnalysis, RequirementCoverageSuggestion, RequirementRecord } from "../../../common/services/requirementService";
import type { RawRequirement } from "../../../common/types/workflow";

interface Props {
  projectId?: number;
  requirements: RequirementRecord[];
  requirementValues: Record<number, RawRequirement>;
  coverageAnalysis: RequirementCoverageAnalysis | null;
  loadingCoverage: boolean;
  addedCoverageSuggestions: number[];
  coverageAddedCount: number;
  selectedCoverageSuggestions: Record<number, boolean>;
  selectedCoverageIndexes: number[];
  onCheckCoverage: () => void;
  onToggleCoverageSuggestion: (index: number, selected: boolean) => void;
  busy: boolean;
  loaded: boolean;
  error: string;
  onStepChange: (step: number) => void;
  requirementTitle: (raw: RawRequirement) => string;
  wrapClass: string;
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
    <div className={`flex min-w-0 items-center justify-start gap-3 rounded-xl border px-4 py-3 ${styles[tone]}`}>
      <div className="flex h-14 w-16 shrink-0 items-center justify-center">
        <p className="text-3xl font-bold leading-none tracking-tight sm:text-4xl">{value}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{label}</p>
        <p className="mt-1 text-xs leading-tight opacity-70">{detail}</p>
      </div>
    </div>
  );
}

export default function Step2PhanTichYeuCau({
  requirements,
  requirementValues,
  coverageAnalysis,
  loadingCoverage,
  addedCoverageSuggestions,
  coverageAddedCount,
  selectedCoverageSuggestions,
  selectedCoverageIndexes,
  onCheckCoverage,
  onToggleCoverageSuggestion,
  onAddSelectedCoverage,
  busy,
  requirementTitle,
  wrapClass: inheritedWrapClass,
}: Props) {
  const draftRequirements = requirements.filter((item) => item.status === "draft");
  const confirmedCount = requirements.filter((item) => item.status === "confirmed").length;
  const addedCount = coverageAddedCount;
  const analyzedCount = requirements.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Yêu cầu cần rà soát" value={draftRequirements.length} detail="Yêu cầu chưa xác nhận" />
        <Metric label="Đã phân tích" value={analyzedCount} detail="Tổng yêu cầu đã xác nhận và chưa xác nhận" />
        <Metric label="Đủ thông tin" value={confirmedCount} detail="Yêu cầu đã xác nhận" tone="success" />
        <Metric label="Cần bổ sung" value={addedCount} detail="Gợi ý AI đã được chọn thêm" tone={addedCount ? "warn" : "neutral"} />
      </div>

      <Card tone="emerald" title="Kiểm tra độ bao phủ chức năng" subtitle="AI rà soát danh sách yêu cầu hiện tại và đề xuất chức năng thiết yếu có thể còn thiếu. Gợi ý chỉ được lưu khi bạn chọn thêm." actions={
        <SoftButton disabled={busy || loadingCoverage || requirements.length === 0} onClick={onCheckCoverage}>
          {loadingCoverage ? "Đang kiểm tra..." : coverageAnalysis ? "Kiểm tra lại bằng AI" : "Kiểm tra bằng AI"}
        </SoftButton>
      }>
        {!coverageAnalysis ? (
          <EmptyState title="Chưa kiểm tra độ bao phủ" hint="Chạy kiểm tra để xem các chức năng nào có thể đang thiếu trước khi tiếp tục quy trình." />
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-700">{coverageAnalysis.summary}</p>
            {coverageAnalysis.suggestions.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">AI chưa phát hiện chức năng thiết yếu nào cần đề xuất thêm.</div>
            ) : (
              <div className="space-y-3">
                {coverageAnalysis.suggestions.map((suggestion: RequirementCoverageSuggestion, index: number) => {
                  const added = addedCoverageSuggestions.includes(index);
                  return <label key={`${suggestion.actor}-${suggestion.action}-${suggestion.target_object}-${index}`} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${added ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-white hover:border-emerald-300"}`}>
                    <input type="checkbox" className="mt-1" checked={added || Boolean(selectedCoverageSuggestions[index])} disabled={busy || added} onChange={(event) => onToggleCoverageSuggestion(index, event.target.checked)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{suggestion.actor}: {suggestion.action} {suggestion.target_object}</span>
                      <span className="mt-1 block text-sm text-slate-600">{suggestion.purpose}</span>
                      {suggestion.reason && <span className="mt-2 block text-xs text-slate-500">Lý do đề xuất: {suggestion.reason}</span>}
                      {added && <span className="mt-2 inline-block text-xs font-semibold text-emerald-700">Đã thêm vào yêu cầu</span>}
                    </span>
                  </label>;
                })}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">Tích chọn một gợi ý để tự động thêm ngay vào danh sách yêu cầu.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
