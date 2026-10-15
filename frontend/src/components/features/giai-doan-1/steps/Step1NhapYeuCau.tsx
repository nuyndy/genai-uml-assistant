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
  onStepChange: (step: number) => void;
  requirementTitle: (raw: RawRequirement) => string;
}

export default function Step1NhapYeuCau({
  newRequirement, requirementValues, requirements, busy, loaded, error,
  coverageAnalysis, loadingCoverage, addedCoverageSuggestions, selectedCoverageSuggestions,
  selectedCoverageIndexes, onChangeNewField, onChangeNewList, onAddRequirement,
  onRemoveRequirement, onCheckCoverage, onToggleCoverageSuggestion, onAddSelectedCoverage,
  onStepChange, requirementTitle,
}: Props) {
  const draftCount = requirements.filter((item) => item.status === "draft").length;
  const confirmedCount = requirements.length - draftCount;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-7">
        <div aria-hidden="true" className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-emerald-100/70 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Giai đoạn 1 · Phân tích và chốt yêu cầu</p>
            <h2 className={`mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl ${wrapClass}`}>Nhập yêu cầu người dùng</h2>
            <p className={`mt-2 text-sm leading-6 text-slate-600 ${wrapClass}`}>Mô tả ai thực hiện hành động gì, trên đối tượng nào và nhằm mục đích gì. Sau khi lưu, bạn có thể kiểm tra độ bao phủ chức năng trước khi sang bước phân tích.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 font-semibold text-emerald-700">01</span>
            <span><span className="block font-medium text-slate-900">Nhập yêu cầu</span><span className="block text-xs text-slate-500">Bước 1 / 5</span></span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <Card tone="emerald" title="Tạo yêu cầu mới" subtitle="Các trường có dấu * là bắt buộc. Mỗi yêu cầu nên mô tả một mục tiêu nghiệp vụ cụ thể.">
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
                  <div className="min-w-0 flex-1"><p className={`break-words text-sm font-medium text-slate-900 ${wrapClass}`}>{rawValue ? requirementTitle(rawValue) : `Yêu cầu ${item.id}`}</p><div className="mt-2"><StatusBadge tone={item.status === "draft" ? "warn" : "success"}>{item.status === "draft" ? "Bản nháp" : "Đã xác nhận"}</StatusBadge></div></div>
                  {item.status === "draft" && <RemoveButton label={`Xóa yêu cầu ${item.id}`} disabled={busy} onClick={() => onRemoveRequirement(item.id)} />}
                </li>;
              })}
            </ul>
          )}
        </Card>
      </div>

      {requirements.length > 0 && <Card tone="amber" title="Kiểm tra độ bao phủ chức năng" subtitle="AI rà soát danh sách hiện tại và đề xuất chức năng thiết yếu có thể còn thiếu. Gợi ý không được lưu cho đến khi bạn chọn thêm." actions={<SoftButton disabled={busy || loadingCoverage || !loaded} onClick={onCheckCoverage}>{loadingCoverage ? "Đang kiểm tra..." : "Kiểm tra bằng AI"}</SoftButton>}>
        {!coverageAnalysis ? <div className="flex flex-col gap-3 rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-4 sm:flex-row sm:items-center sm:justify-between"><p className={`text-sm text-slate-700 ${wrapClass}`}>Chạy kiểm tra để xem các chức năng nào có thể đang thiếu trước khi chuyển sang Bước 2.</p><span className="shrink-0 text-xs font-medium text-amber-800">Chưa kiểm tra</span></div> : (
          <div className="space-y-4">
            <div className={`rounded-xl border p-4 text-sm ${coverageAnalysis.is_sufficient ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"} ${wrapClass}`}><p className="font-semibold">{coverageAnalysis.is_sufficient ? "Độ bao phủ có vẻ đầy đủ" : "Có thể còn thiếu chức năng"}</p><p className="mt-1">{coverageAnalysis.summary}</p></div>
            {addedCoverageSuggestions.length > 0 && <p className="text-xs text-emerald-700">Đã thêm {addedCoverageSuggestions.length} chức năng được chọn. Kết quả kiểm tra đang hiển thị vẫn phản ánh danh sách trước khi bổ sung; hãy chạy kiểm tra lại để cập nhật.</p>}
            {coverageAnalysis.suggestions.length > 0 ? <div className="space-y-3">
              <div><h4 className="text-sm font-semibold text-slate-900">Gợi ý chức năng còn thiếu</h4><p className="mt-1 text-xs text-slate-500">Chọn từng gợi ý bạn muốn đưa vào danh sách yêu cầu.</p></div>
              {coverageAnalysis.suggestions.map((suggestion, index) => {
                const alreadyAdded = addedCoverageSuggestions.includes(index);
                return <label key={`${suggestion.action}-${suggestion.target_object}-${index}`} className={`flex min-w-0 cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${alreadyAdded ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}>
                  <input type="checkbox" aria-label={`Chọn chức năng ${suggestion.action} ${suggestion.target_object}`} checked={!alreadyAdded && Boolean(selectedCoverageSuggestions[index])} disabled={busy || alreadyAdded} onChange={(event) => onToggleCoverageSuggestion(index, event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-emerald-700" />
                  <span className={`min-w-0 flex-1 text-sm text-slate-700 ${wrapClass}`}><span className="block font-medium text-slate-900">{suggestion.actor}: {suggestion.action} {suggestion.target_object}</span><span className="mt-1 block text-slate-600">Mục đích: {suggestion.purpose}</span><span className="mt-2 block text-xs text-slate-500">Lý do đề xuất: {suggestion.reason}</span>{alreadyAdded && <span className="mt-2 block text-xs font-medium text-emerald-700">Đã thêm vào danh sách yêu cầu.</span>}</span>
                </label>;
              })}
              {selectedCoverageIndexes.length > 0 && <div className="flex justify-end"><PrimaryButton disabled={busy} onClick={onAddSelectedCoverage}>Thêm {selectedCoverageIndexes.length} chức năng đã chọn</PrimaryButton></div>}
            </div> : <EmptyState title="Không có gợi ý bổ sung" hint="AI chưa phát hiện chức năng thiết yếu nào khác trong lần kiểm tra này." />}
          </div>
        )}
        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">Bạn vẫn có thể quay lại chỉnh sửa danh sách ở bất kỳ lúc nào.</p><PrimaryButton disabled={busy || !loaded || !coverageAnalysis || selectedCoverageIndexes.length > 0} onClick={() => onStepChange(2)}>Tiếp tục sang Bước 2</PrimaryButton></div>
      </Card>}
    </div>
  );
}
