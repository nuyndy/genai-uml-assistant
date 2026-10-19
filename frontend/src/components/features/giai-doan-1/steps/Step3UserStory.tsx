import { Card, GhostButton, PrimaryButton, EmptyState, SoftButton, StatusBadge, wrapClass as defaultWrapClass } from "../../../common/ui/primitives";
import type { RawRequirement } from "../../../../types/workflow";
import type { UserStoryDraft } from "../../../../services/requirementService";

interface Props {
  projectId?: number;
  draftRequirements: any[];
  requirementValues: Record<number, RawRequirement>;
  storyDrafts: Record<number, UserStoryDraft>;
  loadingStoryDrafts: boolean;
  busy: boolean;
  loaded: boolean;
  error: string;
  allStoryDraftsReady: boolean;
  allRequirementsConfirmed: boolean;
  generateStoryDrafts: () => void;
  changeStoryDraft: (requirementId: number, field: Exclude<keyof UserStoryDraft, "requirement_id">, value: string) => void;
  confirmAll: () => void;
  onStepChange: (step: number) => void;
  requirementTitle: (raw: RawRequirement) => string;
  wrapClass: string;
  inputClass: string;
}

export default function Step3UserStory({
  draftRequirements,
  requirementValues,
  storyDrafts,
  loadingStoryDrafts,
  busy,
  allStoryDraftsReady,
  allRequirementsConfirmed,
  generateStoryDrafts,
  changeStoryDraft,
  confirmAll,
  onStepChange,
  requirementTitle,
  wrapClass,
  inputClass,
}: Props) {
  const total = draftRequirements.length;
  const readyCount = draftRequirements.filter((item) => {
    const story = storyDrafts[item.id];
    return Boolean(story && [story.role, story.feature, story.benefit, story.acceptance_criteria].every((value) => value.trim()));
  }).length;
  const canConfirm = !busy && !loadingStoryDrafts && allStoryDraftsReady;
  const textWrap = wrapClass || defaultWrapClass;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">Yêu cầu cần duyệt</p><p className="mt-1 text-2xl font-semibold text-slate-900">{total}</p><p className="mt-1 text-xs text-slate-500">Yêu cầu đang ở trạng thái bản nháp</p></div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm text-emerald-800">User Story đã đủ trường</p><p className="mt-1 text-2xl font-semibold text-emerald-900">{allRequirementsConfirmed ? total : readyCount}</p><p className="mt-1 text-xs text-emerald-800">Vai trò, chức năng, lợi ích và tiêu chí</p></div>
        <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-4 lg:col-span-1"><p className="text-sm text-amber-900">Trạng thái kiểm duyệt</p><div className="mt-2"><StatusBadge tone={allRequirementsConfirmed ? "success" : allStoryDraftsReady ? "success" : "warn"}>{allRequirementsConfirmed ? "Đã xác nhận" : allStoryDraftsReady ? "Sẵn sàng xác nhận" : "Cần hoàn thiện"}</StatusBadge></div><p className="mt-2 text-xs text-amber-900">{allRequirementsConfirmed ? "Các yêu cầu đã được lưu và xác nhận." : "Kiểm tra nội dung trước khi chốt."}</p></div>
      </div>

      {allRequirementsConfirmed ? (
        <Card tone="emerald" title="Yêu cầu đã được xác nhận" subtitle="Các User Story đã lưu thành công.">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-sm leading-6 text-slate-700 ${textWrap}`}>Bạn có thể tiếp tục sang Bước 4 để tạo đặc tả chức năng và phi chức năng.</p>
            
          </div>
        </Card>
      ) : total === 0 ? (
        <Card title="Chưa có yêu cầu để rà soát">
          <EmptyState title="Danh sách yêu cầu đang trống" hint="Quay lại Bước 1 để thêm yêu cầu, sau đó phân tích và tạo User Story." />
          <div className="mt-4 flex justify-start"></div>
        </Card>
      ) : (
        <Card tone="emerald" title="Bản nháp User Story" subtitle="Nội dung được AI đề xuất từ yêu cầu gốc. Bạn có thể chỉnh sửa trực tiếp trước khi xác nhận." actions={
          <SoftButton disabled={busy || loadingStoryDrafts} onClick={() => void generateStoryDrafts()}>
            {loadingStoryDrafts ? "Đang tạo bản nháp..." : "Tạo lại bằng AI"}
          </SoftButton>
        }>
          {loadingStoryDrafts ? (
            <div role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-semibold text-emerald-900">AI đang tạo User Story</p>
              <p className="mt-1 text-sm text-emerald-800">Đang chuẩn bị bản nháp cho {total} yêu cầu. Vui lòng chờ kết quả.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {draftRequirements.map((item, index) => {
                const rawValue = requirementValues[item.id] ?? { actor: "", action: "", targetObject: "", purpose: "", preConditions: [], businessRules: [] };
                const story = storyDrafts[item.id];
                const storyReady = Boolean(story && [story.role, story.feature, story.benefit, story.acceptance_criteria].every((value) => value.trim()));
                return (
                  <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800">{String(index + 1).padStart(2, "0")}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2"><h3 className={`break-words text-sm font-semibold leading-6 text-slate-900 ${textWrap}`}>{requirementTitle(rawValue)}</h3><StatusBadge tone={storyReady ? "success" : "warn"}>{storyReady ? "Đủ trường bắt buộc" : story ? "Cần hoàn thiện" : "Chưa có bản nháp"}</StatusBadge></div>
                        <p className={`mt-1 text-sm leading-5 text-slate-600 ${textWrap}`}>Yêu cầu gốc: {rawValue.purpose || "Chưa có mục đích được mô tả."}</p>
                        <p className="mt-1 text-xs text-slate-500">Mã yêu cầu: REQ-{String(item.id).padStart(3, "0")}</p>
                      </div>
                    </div>
                    {!story ? (
                      <div className="p-4 sm:p-5"><p className="text-sm text-amber-800">Chưa có bản nháp cho yêu cầu này. Hãy tạo lại bản nháp bằng AI.</p></div>
                    ) : (
                      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                        <label className="block text-sm font-medium text-slate-700">Vai trò <span className="text-rose-600">*</span>
                          <input aria-label={`Vai trò User Story ${item.id}`} value={story.role ?? ""} onChange={(event) => changeStoryDraft(item.id, "role", event.target.value)} className={`${inputClass} mt-1.5 bg-white`} placeholder="Ví dụ: Khách hàng" />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">Chức năng <span className="text-rose-600">*</span>
                          <input aria-label={`Chức năng User Story ${item.id}`} value={story.feature} onChange={(event) => changeStoryDraft(item.id, "feature", event.target.value)} className={`${inputClass} mt-1.5 bg-white`} placeholder="Tôi muốn thực hiện chức năng gì?" />
                        </label>
                        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Lợi ích / mục đích <span className="text-rose-600">*</span>
                          <textarea aria-label={`Lợi ích User Story ${item.id}`} value={story.benefit ?? ""} onChange={(event) => changeStoryDraft(item.id, "benefit", event.target.value)} rows={3} className={`${inputClass} mt-1.5 resize-y bg-white ${textWrap}`} placeholder="Để đạt được lợi ích hoặc mục tiêu nào?" />
                        </label>
                        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Tiêu chí chấp nhận <span className="text-rose-600">*</span>
                          <textarea aria-label={`Tiêu chí chấp nhận User Story ${item.id}`} value={story.acceptance_criteria ?? ""} onChange={(event) => changeStoryDraft(item.id, "acceptance_criteria", event.target.value)} rows={4} className={`${inputClass} mt-1.5 resize-y bg-white ${textWrap}`} placeholder="Mô tả điều kiện để xác định chức năng hoạt động đúng..." />
                          <span className="mt-1 block text-xs font-normal text-slate-500">Nên mô tả kết quả quan sát được để có thể kiểm thử.</span>
                        </label>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-xs leading-5 text-slate-500 ${textWrap}`}>AI chỉ tạo bản nháp; bạn chịu trách nhiệm rà soát nội dung trước khi lưu xác nhận.</p>
            <PrimaryButton disabled={!canConfirm} onClick={() => void confirmAll()}>{busy ? "Đang xác nhận..." : "Xác nhận yêu cầu & User Story"} <span aria-hidden="true">→</span></PrimaryButton>
          </div>
          {!allStoryDraftsReady && !loadingStoryDrafts && <p className="mt-3 text-right text-sm text-amber-800">Cần hoàn thiện đủ 4 trường cho mọi User Story trước khi xác nhận.</p>}
        </Card>
      )}

      {!allRequirementsConfirmed && <div className="flex justify-start"></div>}
    </div>
  );
}
