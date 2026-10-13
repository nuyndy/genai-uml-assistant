import { Card, EmptyState, PrimaryButton, RemoveButton, SoftButton, StatusBadge, wrapClass } from "../../../common/ui/primitives";
import RequirementFormFields from "../../../step1/RequirementFormFields";
import type { RequirementInput } from "../../../step1/types";
import type {
  RawRequirement,
  RequirementRecord,
  RequirementCoverageAnalysis,
} from "../../../../types/workflow";

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
  onChangeNewList: (
    field: "preConditions" | "businessRules",
    value: string[],
  ) => void;
  onAddRequirement: () => void;
  onRemoveRequirement: (id: number) => void;
  onCheckCoverage: () => void;
  onAddSelectedCoverage: () => void;
  onStepChange: (step: number) => void;
  requirementTitle: (raw: RawRequirement) => string;
}

export default function Step1NhapYeuCau({
  newRequirement,
  requirementValues,
  requirements,
  busy,
  loaded,
  error,
  coverageAnalysis,
  loadingCoverage,
  addedCoverageSuggestions,
  selectedCoverageSuggestions,
  selectedCoverageIndexes,
  onChangeNewField,
  onChangeNewList,
  onAddRequirement,
  onRemoveRequirement,
  onCheckCoverage,
  onAddSelectedCoverage,
  onStepChange,
  requirementTitle,
}: Props) {
  return (
    <div className="space-y-5">
      <Card tone="violet" title="Nhập yêu cầu người dùng">
        <RequirementFormFields
          value={newRequirement}
          onChange={onChangeNewField}
          preConditions={newRequirement.preConditions}
          businessRules={newRequirement.businessRules}
          onChangeList={onChangeNewList}
          error={error}
          checkLabel={busy ? "Đang lưu..." : "Thêm vào danh sách"}
          disabled={busy || !loaded}
          onCheck={onAddRequirement}
        />
      </Card>
      <Card
        title="Yêu cầu đã lưu"
        actions={
          <StatusBadge tone={requirements.length ? "success" : "muted"}>
            {requirements.length} mục
          </StatusBadge>
        }
      >
        {requirements.length === 0 ? (
          <EmptyState
            title="Chưa có yêu cầu"
            hint="Thêm ít nhất một yêu cầu để tiếp tục."
          />
        ) : (
          <ul className="space-y-2">
            {requirements.map((item) => {
              const rawValue = requirementValues[item.id];
              return (
                <li
                  key={item.id}
                  className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={`break-words text-sm font-medium text-slate-800 ${wrapClass}`}
                    >
                      {rawValue
                        ? requirementTitle(rawValue)
                        : `Yêu cầu ${item.id}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.status === "draft" ? "Bản nháp" : "Đã xác nhận"}
                    </p>
                  </div>
                  {item.status === "draft" && (
                    <RemoveButton
                      label={`Xóa yêu cầu ${item.id}`}
                      onClick={() => onRemoveRequirement(item.id)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {requirements.length > 0 && (
        <div className="space-y-4">
          <Card
            tone="amber"
            title="Kiểm tra mức độ đầy đủ chức năng"
            subtitle="AI rà soát các yêu cầu đã lưu và đề xuất những chức năng thiết yếu có thể còn thiếu. Gợi ý chỉ được lưu nếu bạn chọn thêm."
            actions={
              <SoftButton
                disabled={busy || loadingCoverage || !loaded}
                onClick={onCheckCoverage}
              >
                {loadingCoverage ? "Đang kiểm tra..." : "Kiểm tra chức năng"}
              </SoftButton>
            }
          >
            {!coverageAnalysis ? (
              <p className="text-sm text-slate-600">
                Kiểm tra trước khi sang Bước 2 để xem hệ thống còn thiếu chức
                năng nào.
              </p>
            ) : (
              <div className="space-y-4">
                <p
                  role="status"
                  className={`rounded-lg p-3 text-sm ${coverageAnalysis.is_sufficient ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
                >
                  {coverageAnalysis.summary}
                </p>
                {addedCoverageSuggestions.length > 0 && (
                  <p className="text-xs text-emerald-700">
                    Đã thêm {addedCoverageSuggestions.length} chức năng được
                    chọn. Kết quả kiểm tra phía trên dựa trên danh sách trước
                    khi bổ sung.
                  </p>
                )}
                {coverageAnalysis.suggestions.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-800">
                      Chức năng AI đề xuất còn thiếu
                    </h4>
                    {coverageAnalysis.suggestions.map((suggestion, index) => {
                      const alreadyAdded =
                        addedCoverageSuggestions.includes(index);
                      return (
                        <label
                          key={`${suggestion.action}-${suggestion.target_object}-${index}`}
                          className={`flex gap-3 rounded-xl border p-3 ${alreadyAdded ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Chọn chức năng ${suggestion.action} ${suggestion.target_object}`}
                            checked={
                              !alreadyAdded &&
                              Boolean(selectedCoverageSuggestions[index])
                            }
                            disabled={busy || alreadyAdded}
                            onChange={(event) => {
                              const newSelections = {
                                ...selectedCoverageSuggestions,
                              };
                              newSelections[index] = event.target.checked;
                              // Call parent setter via passed function if needed
                            }}
                            className="mt-1 h-4 w-4 shrink-0 accent-violet-600"
                          />
                          <span className="min-w-0 text-sm text-slate-700">
                            <span className={`block font-medium ${wrapClass}`}>
                              {suggestion.actor}: {suggestion.action}{" "}
                              {suggestion.target_object}
                            </span>
                            <span
                              className={`mt-1 block text-slate-600 ${wrapClass}`}
                            >
                              Mục đích: {suggestion.purpose}
                            </span>
                            <span
                              className={`mt-1 block text-xs text-slate-500 ${wrapClass}`}
                            >
                              Lý do đề xuất: {suggestion.reason}
                            </span>
                            {alreadyAdded && (
                              <span className="mt-1 block text-xs font-medium text-emerald-700">
                                Đã thêm vào danh sách yêu cầu.
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                    {selectedCoverageIndexes.length > 0 && (
                      <div className="flex justify-end">
                        <PrimaryButton
                          disabled={busy}
                          onClick={onAddSelectedCoverage}
                        >
                          Thêm {selectedCoverageIndexes.length} chức năng đã
                          chọn
                        </PrimaryButton>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
          <div className="flex justify-end">
            <PrimaryButton
              disabled={
                busy ||
                !loaded ||
                !coverageAnalysis ||
                selectedCoverageIndexes.length > 0
              }
              onClick={() => onStepChange(2)}
            >
              Tiếp tục sang Bước 2
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
