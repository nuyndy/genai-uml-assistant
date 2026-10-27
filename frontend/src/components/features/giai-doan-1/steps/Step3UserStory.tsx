import { useState } from "react";
import { Card, PrimaryButton, EmptyState, SoftButton, StatusBadge, wrapClass as defaultWrapClass } from "../../../common/ui/primitives";
import type { RawRequirement } from "../../../common/types/workflow";
import { saveRequirementUserStory, type UserStory, type UserStoryDraft } from "../../../common/services/requirementService";

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
  changeStoryDraft: (requirementId: number, field: Exclude<keyof UserStoryDraft, "requirement_id">, value: string) => void;
  generateStoryDrafts: (requirementId?: number) => Promise<void>;
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
  changeStoryDraft,
  generateStoryDrafts,
  requirementTitle,
  wrapClass,
  inputClass,
}: Props) {
  const [activeDraftIndex, setActiveDraftIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const orderedDrafts = [...draftRequirements].reverse();
  const activeDraftRequirement = orderedDrafts[activeDraftIndex];
  const total = draftRequirements.length;
  const generatedCount = draftRequirements.filter((item) => Boolean(storyDrafts[item.id])).length;
  const readyCount = draftRequirements.filter((item) => {
    const story = storyDrafts[item.id];
    return Boolean(story && [story.role, story.feature, story.benefit, story.acceptance_criteria].every((value) => value.trim()));
  }).length;
  const textWrap = wrapClass || defaultWrapClass;

  return (
    <div className="space-y-6">
      {allRequirementsConfirmed ? null : total === 0 ? (
        <Card title="Chưa có yêu cầu để rà soát">
          <EmptyState title="Danh sách yêu cầu đang trống" hint="Quay lại Bước 1 để thêm yêu cầu, sau đó phân tích và tạo User Story." />
          <div className="mt-4 flex justify-start"></div>
        </Card>
      ) : (
        <div className="space-y-3">
          {loadingStoryDrafts ? (
            <div role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-semibold text-emerald-900">AI đang tạo User Story</p>
              <p className="mt-1 text-sm text-emerald-800">Đang chuẩn bị bản nháp cho {total} yêu cầu. Vui lòng chờ kết quả.</p>
            </div>
          ) : (
            <div className="space-y-3">
              
              {(orderedDrafts[activeDraftIndex] ? [orderedDrafts[activeDraftIndex]] : []).map((item) => {
                const rawValue = requirementValues[item.id] ?? { actor: "", action: "", targetObject: "", purpose: "", preConditions: [], businessRules: [] };
                const savedDraft = storyDrafts[item.id];
                const story: UserStoryDraft = savedDraft ?? { requirement_id: item.id, role: "", feature: "", benefit: "", acceptance_criteria: "" };
                const storyReady = Boolean(savedDraft && [story.role, story.feature, story.benefit, story.acceptance_criteria].every((value) => value.trim()));
                return (
                  <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800">{String(activeDraftIndex + 1).padStart(2, "0")}</span>
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
                  </article>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
            <SoftButton disabled={activeDraftIndex === 0 || busy || loadingStoryDrafts} onClick={() => setActiveDraftIndex((i) => Math.max(0, i - 1))}>← Trước</SoftButton>
            <SoftButton disabled={activeDraftIndex >= orderedDrafts.length - 1 || busy || loadingStoryDrafts} onClick={() => setActiveDraftIndex((i) => Math.min(orderedDrafts.length - 1, i + 1))}>Sau →</SoftButton>
            <SoftButton disabled={!activeDraftRequirement || busy || loadingStoryDrafts} onClick={() => { if (activeDraftRequirement) void generateStoryDrafts(activeDraftRequirement.id); }}>Hoàn thiện UC này bằng AI</SoftButton>
            <PrimaryButton disabled={!activeDraftRequirement || !storyDrafts[activeDraftRequirement.id] || ![storyDrafts[activeDraftRequirement.id]?.role, storyDrafts[activeDraftRequirement.id]?.feature, storyDrafts[activeDraftRequirement.id]?.benefit, storyDrafts[activeDraftRequirement.id]?.acceptance_criteria].every((v) => Boolean(v?.trim())) || busy || saving} onClick={() => void (async () => { if (!activeDraftRequirement) return; setSaving(true); setActionMessage(""); try { const saved = await saveRequirementUserStory(activeDraftRequirement.id, storyDrafts[activeDraftRequirement.id]); setActionMessage("Đã lưu US-" + String(saved.id).padStart(3, "0") + "."); window.location.reload(); } catch (e) { setActionMessage(e instanceof Error ? e.message : "Không thể lưu User Story."); } finally { setSaving(false); } })()}>{saving ? "Đang lưu..." : "Lưu US"}</PrimaryButton>
            <PrimaryButton disabled={busy || loadingStoryDrafts || draftRequirements.length === 0} onClick={() => void generateStoryDrafts()}>Hoàn thiện tất cả UC bằng AI</PrimaryButton>
          </div>
          {actionMessage && <p role="status" className="mt-3 text-sm text-slate-600">{actionMessage}</p>}
        </div>
      )}

      {!allRequirementsConfirmed && <div className="flex justify-start"></div>}
    </div>
  );
}
