import { useState } from "react";
import { Card, PrimaryButton, EmptyState, SoftButton, StatusBadge, wrapClass as defaultWrapClass } from "../../../common/ui/primitives";
import type { RawRequirement } from "../../../../types/workflow";
import { improveUserStory, saveRequirementUserStory, updateUserStory, type UserStory, type UserStoryDraft } from "../../../../services/requirementService";

interface Props {
  projectId?: number;
  draftRequirements: any[];
  confirmedRequirementsCount: number;
  savedStories: UserStory[];
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
  confirmedRequirementsCount,
  savedStories,
  requirementValues,
  storyDrafts,
  loadingStoryDrafts,
  busy,
  allStoryDraftsReady,
  allRequirementsConfirmed,
  generateStoryDrafts,
  changeStoryDraft,
  confirmAll,
  requirementTitle,
  wrapClass,
  inputClass,
}: Props) {
  const [activeDraftIndex, setActiveDraftIndex] = useState(0);
  const [activeSavedIndex, setActiveSavedIndex] = useState(0);
  const [savedEdits, setSavedEdits] = useState<Record<number, UserStory>>({});
  const [saving, setSaving] = useState(false);
  const [improving, setImproving] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const orderedDrafts = [...draftRequirements].reverse();
  const activeDraftRequirement = orderedDrafts[activeDraftIndex];
  const orderedSavedStories = [...savedStories].sort((a, b) => b.id - a.id);
  const activeSavedStoryBase = orderedSavedStories[activeSavedIndex];
  const activeSavedStory = activeSavedStoryBase ? (savedEdits[activeSavedStoryBase.id] ?? activeSavedStoryBase) : undefined;
  const total = draftRequirements.length;
  const generatedCount = draftRequirements.filter((item) => Boolean(storyDrafts[item.id])).length;
  const readyCount = draftRequirements.filter((item) => {
    const story = storyDrafts[item.id];
    return Boolean(story && [story.role, story.feature, story.benefit, story.acceptance_criteria].every((value) => value.trim()));
  }).length;
  const canConfirm = !busy && !loadingStoryDrafts && allStoryDraftsReady;
  const textWrap = wrapClass || defaultWrapClass;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex min-w-0 items-center justify-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <div className="flex h-14 w-16 shrink-0 items-center justify-center"><p className="text-3xl font-bold leading-none tracking-tight sm:text-4xl">{total}</p></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-tight">Yêu cầu cần duyệt</p><p className="mt-1 text-xs leading-tight opacity-75">Yêu cầu còn bản nháp</p></div>
        </div>
        <div className="flex min-w-0 items-center justify-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900">
          <div className="flex h-14 w-16 shrink-0 items-center justify-center"><p className="text-3xl font-bold leading-none tracking-tight sm:text-4xl">{generatedCount}</p></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-tight">AI đã sinh</p><p className="mt-1 text-xs leading-tight opacity-75">Có bản nháp User Story</p></div>
        </div>
        <div className="flex min-w-0 items-center justify-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
          <div className="flex h-14 w-16 shrink-0 items-center justify-center"><p className="text-3xl font-bold leading-none tracking-tight sm:text-4xl">{readyCount}</p></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-tight">Đủ trường</p><p className="mt-1 text-xs leading-tight opacity-75">Đủ 4 trường bắt buộc</p></div>
        </div>
        <div className="flex min-w-0 items-center justify-start gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-violet-900">
          <div className="flex h-14 w-16 shrink-0 items-center justify-center"><p className="text-3xl font-bold leading-none tracking-tight sm:text-4xl">{confirmedRequirementsCount}</p></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-tight">Đã duyệt</p><p className="mt-1 text-xs leading-tight opacity-75">Yêu cầu đã xác nhận</p></div>
        </div>
      </div>

      {orderedSavedStories.length > 0 && activeSavedStory && (
        <Card title={"User Story đã lưu · " + (activeSavedIndex + 1) + "/" + orderedSavedStories.length} subtitle="Hiển thị từng thẻ riêng; US mới nhất được mở trước.">
          <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">USER STORY · US-{String(activeSavedStory.id).padStart(3, "0")} · REQUIREMENT · REQ-{String(activeSavedStory.requirement_id ?? 0).padStart(3, "0")}</p>
                <h3 className={"mt-1 break-words text-base font-semibold leading-6 text-slate-900 " + textWrap}>{activeSavedStory.feature}</h3>
                <div className="mt-2"><StatusBadge tone="success">Đã lưu</StatusBadge></div>
              </div>
              <SoftButton disabled={busy || improving} onClick={() => void (async () => { setImproving(true); setActionMessage(""); try { const result = await improveUserStory(activeSavedStory.id); setSavedEdits((prev) => ({ ...prev, [result.id]: result })); setActionMessage("AI đã hoàn thiện và lưu User Story."); } catch (e) { setActionMessage(e instanceof Error ? e.message : "AI chưa thể hoàn thiện User Story."); } finally { setImproving(false); } })()}>{improving ? "AI đang hoàn thiện..." : "Tạo lại bản nháp bằng AI"}</SoftButton>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">Vai trò *<input value={activeSavedStory.role ?? ""} onChange={(e) => { setSavedEdits((prev) => ({ ...prev, [activeSavedStory.id]: { ...activeSavedStory, role: e.target.value } })); setActionMessage(""); }} className={inputClass + " mt-1.5 bg-white"} /></label>
              <label className="block text-sm font-medium text-slate-700">Chức năng *<input value={activeSavedStory.feature} onChange={(e) => { setSavedEdits((prev) => ({ ...prev, [activeSavedStory.id]: { ...activeSavedStory, feature: e.target.value } })); setActionMessage(""); }} className={inputClass + " mt-1.5 bg-white"} /></label>
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Lợi ích / mục đích *<textarea rows={3} value={activeSavedStory.benefit ?? ""} onChange={(e) => { setSavedEdits((prev) => ({ ...prev, [activeSavedStory.id]: { ...activeSavedStory, benefit: e.target.value } })); setActionMessage(""); }} className={inputClass + " mt-1.5 resize-y bg-white " + textWrap} /></label>
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Tiêu chí chấp nhận *<textarea rows={5} value={activeSavedStory.acceptance_criteria ?? ""} onChange={(e) => { setSavedEdits((prev) => ({ ...prev, [activeSavedStory.id]: { ...activeSavedStory, acceptance_criteria: e.target.value } })); setActionMessage(""); }} className={inputClass + " mt-1.5 resize-y bg-white " + textWrap} placeholder="Mỗi tiêu chí trên một dòng" /></label>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <SoftButton disabled={activeSavedIndex === 0 || saving} onClick={() => { setActiveSavedIndex((i) => Math.max(0, i - 1)); setActionMessage(""); }}>← Trước</SoftButton>
              <div className="flex flex-col gap-2 sm:flex-row">
                <PrimaryButton disabled={saving || improving} onClick={() => void (async () => { setSaving(true); setActionMessage(""); try { const result = await updateUserStory(activeSavedStory.id, { role: activeSavedStory.role, feature: activeSavedStory.feature, benefit: activeSavedStory.benefit, acceptance_criteria: activeSavedStory.acceptance_criteria }); setSavedEdits((prev) => ({ ...prev, [result.id]: result })); setActionMessage("Đã lưu User Story."); } catch (e) { setActionMessage(e instanceof Error ? e.message : "Không thể lưu User Story."); } finally { setSaving(false); } })()}>{saving ? "Đang lưu..." : "Lưu US"}</PrimaryButton>
                <SoftButton disabled={activeSavedIndex >= orderedSavedStories.length - 1 || saving} onClick={() => { setActiveSavedIndex((i) => Math.min(orderedSavedStories.length - 1, i + 1)); setActionMessage(""); }}>Sau →</SoftButton>
              </div>
            </div>
            {actionMessage && <p role="status" className="px-4 pb-4 text-sm text-slate-600">{actionMessage}</p>}
          </article>
        </Card>
      )}
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
            {loadingStoryDrafts ? "Đang tạo bản nháp..." : "Yêu cầu AI hoàn thiện US"}
          </SoftButton>
        }>
          {loadingStoryDrafts ? (
            <div role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-semibold text-emerald-900">AI đang tạo User Story</p>
              <p className="mt-1 text-sm text-emerald-800">Đang chuẩn bị bản nháp cho {total} yêu cầu. Vui lòng chờ kết quả.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(orderedDrafts[activeDraftIndex] ? [orderedDrafts[activeDraftIndex]] : []).map((item, index) => {
                const rawValue = requirementValues[item.id] ?? { actor: "", action: "", targetObject: "", purpose: "", preConditions: [], businessRules: [] };
                const story = storyDrafts[item.id];
                const storyReady = Boolean(story && [story.role, story.feature, story.benefit, story.acceptance_criteria].every((value) => value.trim()));
                return (
                  <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800">{String(index + 1).padStart(2, "0")}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requirement · REQ-{String(item.id).padStart(3, "0")}</p>
                        </div>
                        <h3 className={`mt-1 break-words text-base font-semibold leading-6 text-slate-900 ${textWrap}`}>USER STORY · {story?.feature?.trim() || `Bản nháp cho REQ-${String(item.id).padStart(3, "0")}`}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusBadge tone={story ? "success" : "warn"}>{story ? "AI đã sinh" : "AI chưa sinh"}</StatusBadge>
                          <StatusBadge tone="warn">Chưa duyệt</StatusBadge>
                          <StatusBadge tone={storyReady ? "success" : "warn"}>{storyReady ? "Đủ trường" : "Cần hoàn thiện"}</StatusBadge>
                        </div>
                        <p className={`mt-2 text-sm leading-5 text-slate-600 ${textWrap}`}>Yêu cầu gốc: {requirementTitle(rawValue)} — {rawValue.purpose || "Chưa có mục đích được mô tả."}</p>
                      </div>
                    </div>
                    {!story ? (
                      <div className="p-4 sm:p-5"><p className="text-sm text-amber-800">Chưa có bản nháp cho yêu cầu này. Hãy tạo lại bản nháp bằng AI.</p></div>
                    ) : (
                      <div className="grid gap-3 p-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-700">Vai trò <span className="text-rose-600">*</span>
                          <input aria-label={`Vai trò User Story ${item.id}`} value={story.role ?? ""} onChange={(event) => changeStoryDraft(item.id, "role", event.target.value)} className={`${inputClass} mt-1.5 bg-white`} placeholder="Ví dụ: Khách hàng" />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">Chức năng <span className="text-rose-600">*</span>
                          <input aria-label={`Chức năng User Story ${item.id}`} value={story.feature} onChange={(event) => changeStoryDraft(item.id, "feature", event.target.value)} className={`${inputClass} mt-1.5 bg-white`} placeholder="Tôi muốn thực hiện chức năng gì?" />
                        </label>
                        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Lợi ích / mục đích <span className="text-rose-600">*</span>
                          <textarea aria-label={`Lợi ích User Story ${item.id}`} value={story.benefit ?? ""} onChange={(event) => changeStoryDraft(item.id, "benefit", event.target.value)} rows={3} className={`${inputClass} mt-1.5 resize-y bg-white ${textWrap}`} placeholder="Để đạt được lợi ích hoặc mục tiêu nào?" />
                        </label>
                        <div className="sm:col-span-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div><p className="text-sm font-medium text-slate-700">Tiêu chí chấp nhận <span className="text-rose-600">*</span></p><p className="mt-1 text-xs font-normal text-slate-500">Điều kiện xác định chức năng đáp ứng yêu cầu.</p></div>
                            <SoftButton disabled={busy || loadingStoryDrafts} onClick={() => {
                              const criteria = (story.acceptance_criteria ?? "").split("\\n");
                              changeStoryDraft(item.id, "acceptance_criteria", [...criteria, ""].join("\\n"));
                            }}>+ Thêm tiêu chí</SoftButton>
                          </div>
                          <div className="mt-2 space-y-2">
                            {(story.acceptance_criteria ?? "").split("\\n").map((criterion, criterionIndex, criteria) => (
                              <div key={criterionIndex} className="flex items-start gap-2">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600">{String(criterionIndex + 1).padStart(2, "0")}</span>
                                <input aria-label={`Tiêu chí ${criterionIndex + 1} của User Story ${item.id}`} value={criterion} onChange={(event) => {
                                  const next = [...criteria];
                                  next[criterionIndex] = event.target.value;
                                  changeStoryDraft(item.id, "acceptance_criteria", next.join("\\n"));
                                }} className={`${inputClass} min-w-0 flex-1 bg-white`} placeholder="Nhập điều kiện có thể kiểm thử..." />
                                {criteria.length > 1 && <button type="button" aria-label={`Xóa tiêu chí ${criterionIndex + 1}`} disabled={busy || loadingStoryDrafts} onClick={() => changeStoryDraft(item.id, "acceptance_criteria", criteria.filter((_, index) => index !== criterionIndex).join("\\n"))} className="rounded-lg px-2 py-2 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40">×</button>}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <SoftButton disabled={activeDraftIndex === 0 || busy} onClick={() => setActiveDraftIndex((i) => Math.max(0, i - 1))}>← Trước</SoftButton>
            <p className={`text-xs leading-5 text-slate-500 ${textWrap}`}>Lưu riêng User Story đang mở và xác nhận yêu cầu tương ứng.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <PrimaryButton disabled={!activeDraftRequirement || !storyDrafts[activeDraftRequirement.id] || ![storyDrafts[activeDraftRequirement.id]?.role, storyDrafts[activeDraftRequirement.id]?.feature, storyDrafts[activeDraftRequirement.id]?.benefit, storyDrafts[activeDraftRequirement.id]?.acceptance_criteria].every((v) => Boolean(v?.trim())) || busy || saving} onClick={() => void (async () => { if (!activeDraftRequirement) return; setSaving(true); setActionMessage(""); try { const saved = await saveRequirementUserStory(activeDraftRequirement.id, storyDrafts[activeDraftRequirement.id]); setActionMessage("Đã lưu US-" + String(saved.id).padStart(3, "0") + ". Đang đồng bộ..."); window.location.reload(); } catch (e) { setActionMessage(e instanceof Error ? e.message : "Không thể lưu User Story."); } finally { setSaving(false); } })()}>{saving ? "Đang lưu..." : "Lưu US"}</PrimaryButton>
              <SoftButton disabled={activeDraftIndex >= orderedDrafts.length - 1 || busy} onClick={() => setActiveDraftIndex((i) => Math.min(orderedDrafts.length - 1, i + 1))}>Sau →</SoftButton>
            </div>
          </div>
          {actionMessage && <p role="status" className="mt-3 text-sm text-slate-600">{actionMessage}</p>}
          {!allStoryDraftsReady && !loadingStoryDrafts && <p className="mt-3 text-right text-sm text-amber-800">Cần hoàn thiện đủ 4 trường cho mọi User Story trước khi xác nhận.</p>}
        </Card>
      )}

      {!allRequirementsConfirmed && <div className="flex justify-start"></div>}
    </div>
  );
}
