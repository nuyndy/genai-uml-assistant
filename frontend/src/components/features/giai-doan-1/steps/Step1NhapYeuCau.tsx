import { Card, EmptyState, PrimaryButton, RemoveButton, SoftButton, StatusBadge, wrapClass } from "../../../common/ui/primitives";
import RequirementFormFields from "../../../step1/RequirementFormFields";
import type { RequirementInput } from "../../../step1/types";
import type { RawRequirement } from "../../../../types/workflow";
import type { RequirementRecord, RequirementCoverageAnalysis } from "../../../../services/requirementService";

interface Props {
  newRequirement: RawRequirement;
  requirementValues: Record<number, RawRequirement>;
  requirements: RequirementRecord[];
  busy: boolean;
  loaded: boolean;
  error: string;
  coverageAnalysis: RequirementCoverageAnalysis | null;
  loadingCoverage: boolean;
  addedCoverageSuggestions: number[];
  selectedCoverageSuggestions: Record<number, boolean>;
  selectedCoverageIndexes: number[];
  onChangeNewField: (field: keyof RequirementInput, value: string) => void;
  onChangeNewList: (field: "preConditions" | "businessRules", value: string[]) => void;
  onAddRequirement: () => void;
  onRemoveRequirement: (id: number) => void;
  onCheckCoverage: () => void;
  onToggleCoverageSuggestion: (index: number, selected: boolean) => void;
  onAddSelectedCoverage: () => void;
  requirementTitle: (raw: RawRequirement) => string;
}

export default function Step1NhapYeuCau({
  newRequirement, requirementValues, requirements, busy, loaded, error,
  coverageAnalysis, loadingCoverage, addedCoverageSuggestions, selectedCoverageSuggestions,
  selectedCoverageIndexes, onChangeNewField, onChangeNewList, onAddRequirement,
  onRemoveRequirement, onCheckCoverage, onToggleCoverageSuggestion, onAddSelectedCoverage,
  requirementTitle,
}: Props) {
  const draftCount = requirements.filter((item) => item.status === "draft").length;
  const confirmedCount = requirements.length - draftCount;

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <Card tone="emerald" title="Tạo yêu cầu mới">
          <RequirementFormFields value={newRequirement} onChange={onChangeNewField} preConditions={newRequirement.preConditions} businessRules={newRequirement.businessRules} onChangeList={onChangeNewList} error={error} checkLabel={busy ? "Đang lưu yêu cầu..." : "Thêm yêu cầu"} disabled={busy || !loaded} onCheck={onAddRequirement} />
        </Card>

        <Card title="Danh sách yêu cầu" subtitle="Các yêu cầu đã lưu trong dự án." actions={<StatusBadge tone={requirements.length ? "success" : "muted"}>{requirements.length} yêu cầu</StatusBadge>}>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">Bản nháp</p><p className="mt-1 text-xl font-semibold text-slate-900">{draftCount}</p></div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Đã xác nhận</p><p className="mt-1 text-xl font-semibold text-emerald-800">{confirmedCount}</p></div>
          </div>
          {requirements.length === 0 ? <EmptyState title="Chưa có yêu cầu nào" hint="Điền biểu mẫu và chọn “Thêm yêu cầu” để bắt đầu xây dựng danh sách." /> : (
            <ul className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {requirements.map((item) => {
                const rawValue = requirementValues[item.id];
                return <li key={item.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">{String(item.id).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1"><p className={`break-words text-sm font-medium text-slate-900 ${wrapClass}`}>{rawValue ? requirementTitle(rawValue) : `Yêu cầu ${item.id}`}</p></div>
                  {item.status === "draft" && <RemoveButton label={`Xóa yêu cầu ${item.id}`} disabled={busy} onClick={() => onRemoveRequirement(item.id)} />}
                </li>;
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
