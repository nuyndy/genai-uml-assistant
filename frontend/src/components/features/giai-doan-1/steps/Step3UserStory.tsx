import { useState } from "react";
import { Card, PrimaryButton, EmptyState, SoftButton, StatusBadge, wrapClass as defaultWrapClass } from "../../../common/ui/primitives";
import type { RawRequirement } from "../../../common/types/workflow";
import { saveRequirementUserStory, updateUserStory, improveUserStory, type UserStory, type UserStoryDraft } from "../../../common/services/requirementService";

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
  onStorySaved: (story: UserStory) => void;
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
  savedStories,
  allRequirementsConfirmed,
  onStepChange,
  changeStoryDraft,
  generateStoryDrafts,
  onStorySaved,
  confirmAll,
  allStoryDraftsReady,
  requirementTitle,
  wrapClass,
  inputClass,
}: Props) {
  const [activeDraftIndex, setActiveDraftIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [savedStoryDrafts, setSavedStoryDrafts] = useState<Record<number, UserStoryDraft>>({});
  const [savingSavedStory, setSavingSavedStory] = useState(false);
  const [improvingSavedStory, setImprovingSavedStory] = useState(false);
  const orderedSavedStories = [...savedStories].sort((a, b) => a.id - b.id);
  const activeSavedStory = orderedSavedStories[activeDraftIndex];
  const activeSavedDraft: UserStoryDraft | undefined = activeSavedStory
    ? savedStoryDrafts[activeSavedStory.id] ?? {
        requirement_id: activeSavedStory.requirement_id ?? 0,
        role: activeSavedStory.role ?? "",
        feature: activeSavedStory.feature ?? "",
        benefit: activeSavedStory.benefit ?? "",
        acceptance_criteria: activeSavedStory.acceptance_criteria ?? "",
      }
    : undefined;
  const changeSavedDraft = (field: Exclude<keyof UserStoryDraft, "requirement_id">, value: string) => {
    if (!activeSavedStory || !activeSavedDraft) return;
    setSavedStoryDrafts((previous) => ({
      ...previous,
      [activeSavedStory.id]: { ...activeSavedDraft, [field]: value },
    }));
  };
  const orderedDrafts = [...draftRequirements].reverse();
  const activeDraftRequirement = orderedDrafts[activeDraftIndex];
  const total = draftRequirements.length;
  const textWrap = wrapClass || defaultWrapClass;

  return (
    <div className="space-y-2">
      {allRequirementsConfirmed ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
            <div>
              <h2 className="text-sm font-semibold text-emerald-950">User Story đã duyệt</h2>
              <p className="mt-1 text-sm text-emerald-800">{orderedSavedStories.length ? `Thẻ ${Math.min(activeDraftIndex + 1, orderedSavedStories.length)} / ${orderedSavedStories.length}` : "Chưa có User Story"} · Có thể chỉnh sửa, sinh lại bằng AI và lưu thay đổi.</p>
            </div>
            <PrimaryButton onClick={() => onStepChange(4)}>Tiếp tục đến Bước 4: Đặc tả</PrimaryButton>
          </div>
          {orderedSavedStories.length === 0 ? (
            <Card title="Chưa có User Story được lưu">
              <EmptyState title="Không tìm thấy User Story" hint="Kiểm tra lại dữ liệu User Story đã lưu của dự án." />
            </Card>
          ) : activeSavedStory && activeSavedDraft ? (
            <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">US-{String(activeSavedStory.id).padStart(3, "0")} · REQ-{String(activeSavedStory.requirement_id ?? 0).padStart(3, "0")}</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">{activeSavedDraft.feature.trim() || "User Story chưa có tiêu đề"}</h3>
                  <div className="mt-1"><StatusBadge tone="success">Đã duyệt</StatusBadge></div>
                </div>

              </div>
              <div className="border-b border-slate-100 px-4 py-3 text-xs leading-5 text-slate-600">
                Yêu cầu gốc: {requirementTitle(requirementValues[activeSavedStory.requirement_id ?? 0] ?? { actor: "", action: "", targetObject: "", purpose: "", preConditions: [], businessRules: [] })} — {(requirementValues[activeSavedStory.requirement_id ?? 0]?.purpose) || "Chưa có mục đích được mô tả."}
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">Vai trò *
                  <input value={activeSavedDraft.role} onChange={(event) => changeSavedDraft("role", event.target.value)} className={`${inputClass} mt-1.5 bg-white`} />
                </label>
                <label className="block text-sm font-medium text-slate-700">Chức năng *
                  <textarea value={activeSavedDraft.feature} onChange={(event) => changeSavedDraft("feature", event.target.value)} rows={2} className={`${inputClass} mt-1.5 bg-white ${textWrap}`} />
                </label>
                <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Lợi ích / mục đích *
                  <textarea value={activeSavedDraft.benefit} onChange={(event) => changeSavedDraft("benefit", event.target.value)} rows={3} className={`${inputClass} mt-1.5 bg-white ${textWrap}`} />
                </label>
                <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Tiêu chí chấp nhận *
                  <textarea value={activeSavedDraft.acceptance_criteria} onChange={(event) => changeSavedDraft("acceptance_criteria", event.target.value)} rows={5} className={`${inputClass} mt-1.5 bg-white ${textWrap}`} placeholder="Mỗi tiêu chí một dòng" />
                </label>
              </div>
              <div className="flex flex-nowrap items-center gap-1 overflow-x-auto border-t border-slate-100 bg-slate-50/50 p-1 [&_button]:!whitespace-nowrap [&_button]:!px-2 [&_button]:!py-1 [&_button]:!text-xs">
                <SoftButton disabled={activeDraftIndex <= 0 || busy || savingSavedStory || improvingSavedStory} onClick={() => setActiveDraftIndex((i) => Math.max(0, i - 1))}>← Trước</SoftButton>
                <SoftButton disabled={activeDraftIndex >= orderedSavedStories.length - 1 || busy || savingSavedStory || improvingSavedStory} onClick={() => setActiveDraftIndex((i) => Math.min(orderedSavedStories.length - 1, i + 1))}>Sau →</SoftButton>
                <SoftButton disabled={busy || savingSavedStory || improvingSavedStory} onClick={() => void (async () => {
                  setImprovingSavedStory(true); setActionMessage("");
                  try {
                    const improved = await improveUserStory(activeSavedStory.id);
                    onStorySaved(improved);
                    setSavedStoryDrafts((previous) => { const next = { ...previous }; delete next[activeSavedStory.id]; return next; });
                    setActionMessage("AI đã hoàn thiện User Story.");
                  } catch (reason) { setActionMessage(reason instanceof Error ? reason.message : "Không thể sinh lại User Story bằng AI."); }
                  finally { setImprovingSavedStory(false); }
                })()}>{improvingSavedStory ? "AI đang sinh..." : "Sinh / hoàn thiện bằng AI"}</SoftButton>
                <PrimaryButton disabled={busy || savingSavedStory || improvingSavedStory || ![activeSavedDraft.role, activeSavedDraft.feature, activeSavedDraft.benefit, activeSavedDraft.acceptance_criteria].every((value) => value.trim())} onClick={() => void (async () => {
                  setSavingSavedStory(true); setActionMessage("");
                  try {
                    const updated = await updateUserStory(activeSavedStory.id, {
                      role: activeSavedDraft.role,
                      feature: activeSavedDraft.feature,
                      benefit: activeSavedDraft.benefit,
                      acceptance_criteria: activeSavedDraft.acceptance_criteria,
                    });
                    onStorySaved(updated);
                    setSavedStoryDrafts((previous) => { const next = { ...previous }; delete next[activeSavedStory.id]; return next; });
                    setActionMessage("Đã lưu thay đổi User Story.");
                  } catch (reason) { setActionMessage(reason instanceof Error ? reason.message : "Không thể lưu User Story."); }
                  finally { setSavingSavedStory(false); }
                })()}>{savingSavedStory ? "Đang lưu..." : "Lưu thay đổi"}</PrimaryButton>
                {actionMessage && <p role="status" className="text-sm text-slate-600">{actionMessage}</p>}
              </div>
            </article>
          ) : null}
        </div>
      ) : total === 0 ? (
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
              
          <div className="flex flex-nowrap items-center gap-1 overflow-x-auto rounded-md border border-emerald-200 bg-emerald-50/70 p-1 [&_button]:!whitespace-nowrap [&_button]:!px-2 [&_button]:!py-1 [&_button]:!text-xs">
            <SoftButton disabled={activeDraftIndex === 0 || busy || loadingStoryDrafts} onClick={() => setActiveDraftIndex((i) => Math.max(0, i - 1))}>← Trước</SoftButton>
            <SoftButton disabled={activeDraftIndex >= orderedDrafts.length - 1 || busy || loadingStoryDrafts} onClick={() => setActiveDraftIndex((i) => Math.min(orderedDrafts.length - 1, i + 1))}>Sau →</SoftButton>
            <SoftButton disabled={!activeDraftRequirement || busy || loadingStoryDrafts} onClick={() => { if (activeDraftRequirement) void generateStoryDrafts(activeDraftRequirement.id); }}>Sinh AI</SoftButton>
            <PrimaryButton disabled={!activeDraftRequirement || !storyDrafts[activeDraftRequirement.id] || ![storyDrafts[activeDraftRequirement.id]?.role, storyDrafts[activeDraftRequirement.id]?.feature, storyDrafts[activeDraftRequirement.id]?.benefit, storyDrafts[activeDraftRequirement.id]?.acceptance_criteria].every((v) => Boolean(v?.trim())) || busy || saving} onClick={() => void (async () => { if (!activeDraftRequirement) return; setSaving(true); setActionMessage(""); try { const saved = await saveRequirementUserStory(activeDraftRequirement.id, storyDrafts[activeDraftRequirement.id]); onStorySaved(saved); setActionMessage("Đã lưu US-" + String(saved.id).padStart(3, "0") + "."); } catch (e) { setActionMessage(e instanceof Error ? e.message : "Không thể lưu User Story."); } finally { setSaving(false); } })()}>{saving ? "Đang lưu..." : "Lưu US"}</PrimaryButton>
            <PrimaryButton disabled={busy || loadingStoryDrafts || draftRequirements.length === 0} onClick={() => void generateStoryDrafts()}>Sinh tất cả</PrimaryButton>
            <PrimaryButton disabled={!allStoryDraftsReady || busy || loadingStoryDrafts || saving} onClick={() => confirmAll()}>Duyệt tất cả</PrimaryButton>
          </div>
              {(orderedDrafts[activeDraftIndex] ? [orderedDrafts[activeDraftIndex]] : []).map((item) => {
                const rawValue = requirementValues[item.id] ?? { actor: "", action: "", targetObject: "", purpose: "", preConditions: [], businessRules: [] };
                const savedDraft = storyDrafts[item.id];
                const story: UserStoryDraft = savedDraft ?? { requirement_id: item.id, role: "", feature: "", benefit: "", acceptance_criteria: "" };
                const storyReady = Boolean(savedDraft && [story.role, story.feature, story.benefit, story.acceptance_criteria].every((value) => value.trim()));
                return (
                  <article key={item.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-start gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-[11px] font-bold text-emerald-800">{String(activeDraftIndex + 1).padStart(2, "0")}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requirement · REQ-{String(item.id).padStart(3, "0")}</p>
                        </div>
                        <h3 className={`mt-1 break-words text-sm font-semibold leading-5 text-slate-900 ${textWrap}`}>USER STORY · {story?.feature?.trim() || `Bản nháp cho REQ-${String(item.id).padStart(3, "0")}`}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <StatusBadge tone={savedDraft ? "success" : "warn"}>{savedDraft ? "AI đã sinh" : "AI chưa sinh"}</StatusBadge>
                          <StatusBadge tone="warn">Chưa duyệt</StatusBadge>
                          <StatusBadge tone={storyReady ? "success" : "warn"}>{storyReady ? "Đủ trường" : "Cần hoàn thiện"}</StatusBadge>
                        </div>
                        <p className={`mt-1 text-xs leading-4 text-slate-600 ${textWrap}`}>Yêu cầu gốc: {requirementTitle(rawValue)} — {rawValue.purpose || "Chưa có mục đích được mô tả."}</p>
                      </div>
                    </div>
                    <div className="grid gap-2 p-3 sm:grid-cols-2">
                        <label className="block text-xs font-medium text-slate-700">Vai trò <span className="text-rose-600">*</span>
                          <input aria-label={`Vai trò User Story ${item.id}`} value={story.role ?? ""} onChange={(event) => changeStoryDraft(item.id, "role", event.target.value)} className={`${inputClass} mt-1.5 bg-white`} placeholder="Ví dụ: Khách hàng" />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">Chức năng <span className="text-rose-600">*</span>
                          <input aria-label={`Chức năng User Story ${item.id}`} value={story.feature} onChange={(event) => changeStoryDraft(item.id, "feature", event.target.value)} className={`${inputClass} mt-1.5 bg-white`} placeholder="Tôi muốn thực hiện chức năng gì?" />
                        </label>
                        <label className="block text-xs font-medium text-slate-700 sm:col-span-2">Lợi ích / mục đích <span className="text-rose-600">*</span>
                          <textarea aria-label={`Lợi ích User Story ${item.id}`} value={story.benefit ?? ""} onChange={(event) => changeStoryDraft(item.id, "benefit", event.target.value)} rows={2} className={`${inputClass} mt-1 resize-y bg-white ${textWrap}`} placeholder="Để đạt được lợi ích hoặc mục tiêu nào?" />
                        </label>
                        <div className="sm:col-span-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div><p className="text-sm font-medium text-slate-700">Tiêu chí chấp nhận <span className="text-rose-600">*</span></p><p className="mt-1 text-xs font-normal text-slate-500">Điều kiện xác định chức năng đáp ứng yêu cầu.</p></div>
                            <SoftButton disabled={busy || loadingStoryDrafts} onClick={() => {
                              const criteria = (story.acceptance_criteria ?? "").split("\\n");
                              changeStoryDraft(item.id, "acceptance_criteria", [...criteria, ""].join("\\n"));
                            }}>+ Thêm tiêu chí</SoftButton>
                          </div>
                          <div className="mt-1.5 space-y-1.5">
                            {(story.acceptance_criteria ?? "").split("\\n").map((criterion, criterionIndex, criteria) => (
                              <div key={criterionIndex} className="flex items-start gap-2">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">{String(criterionIndex + 1).padStart(2, "0")}</span>
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
          {actionMessage && <p role="status" className="mt-3 text-sm text-slate-600">{actionMessage}</p>}
        </div>
      )}

      {!allRequirementsConfirmed && <div className="flex justify-start"></div>}
    </div>
  );
}
