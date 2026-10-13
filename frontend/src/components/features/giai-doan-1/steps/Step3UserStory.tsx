import { Card, GhostButton, PrimaryButton, EmptyState, SoftButton } from "../../../common/ui/primitives";
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
  return (
    <div className="space-y-5">
      <Card
        tone="violet"
        title="Kiểm duyệt User Story"
      >
        <p className="text-sm text-slate-700">
          Bản nháp User Story từ các yêu cầu đã nhập. Kiểm tra và chỉnh sửa nội dung chưa phù hợp trước khi xác nhận.
        </p>
      </Card>
      {allRequirementsConfirmed ? (
        <Card tone="emerald" title="Các yêu cầu đã được xác nhận">
          <p className="text-sm text-slate-700">
            User story cho các yêu cầu đã được lưu. Có thể tiếp tục sang Bước 4.
          </p>
        </Card>
      ) : draftRequirements.length === 0 ? (
        <EmptyState
          title="Chưa có yêu cầu để rà soát"
          hint="Quay lại Bước 1 để thêm yêu cầu."
        />
      ) : (
        <>
          <Card
            tone="violet"
            title="Bản nháp User Story do AI bổ sung"
            subtitle="Được tạo từ yêu cầu đã nhập. Kiểm duyệt và chỉnh nội dung nếu cần trước khi xác nhận."
            actions={
              <SoftButton
                disabled={busy || loadingStoryDrafts}
                onClick={() => void generateStoryDrafts()}
              >
                {loadingStoryDrafts ? "Đang phân tích..." : "Tạo lại bản nháp AI"}
              </SoftButton>
            }
          >
            {loadingStoryDrafts ? (
              <p className="text-sm text-slate-600">AI đang phân tích yêu cầu và tạo bản nháp User Story...</p>
            ) : (
              <div className="space-y-5">
                {draftRequirements.map((item) => {
                  const rawValue = requirementValues[item.id] ?? { actor: "", action: "", targetObject: "", purpose: "" };
                  const story = storyDrafts[item.id];
                  return (
                    <section
                      key={item.id}
                      className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Yêu cầu gốc
                        </p>
                        <p className={`mt-1 text-sm text-slate-700 ${wrapClass}`}>
                          {requirementTitle(rawValue)} để {rawValue.purpose}
                        </p>
                      </div>
                      {!story ? (
                        <p className="text-sm text-amber-700">
                          Chưa có bản nháp. Thử tạo lại bằng AI.
                        </p>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="block text-sm font-medium text-slate-700">
                            Vai trò
                            <input
                              aria-label={`Vai trò User Story ${item.id}`}
                              value={story.role ?? ""}
                              onChange={(event) => changeStoryDraft(item.id, "role", event.target.value)}
                              className={`${inputClass} mt-1`}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Chức năng
                            <input
                              aria-label={`Chức năng User Story ${item.id}`}
                              value={story.feature}
                              onChange={(event) => changeStoryDraft(item.id, "feature", event.target.value)}
                              className={`${inputClass} mt-1`}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                            Lợi ích / mục đích
                            <textarea
                              aria-label={`Lợi ích User Story ${item.id}`}
                              value={story.benefit ?? ""}
                              onChange={(event) => changeStoryDraft(item.id, "benefit", event.target.value)}
                              rows={2}
                              className={`${inputClass} mt-1 resize-y`}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                            Tiêu chí chấp nhận
                            <textarea
                              aria-label={`Tiêu chí chấp nhận User Story ${item.id}`}
                              value={story.acceptance_criteria ?? ""}
                              onChange={(event) =>
                                changeStoryDraft(item.id, "acceptance_criteria", event.target.value)
                              }
                              rows={4}
                              className={`${inputClass} mt-1 resize-y`}
                            />
                          </label>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GhostButton onClick={() => onStepChange(2)}>Quay lại Bước 2</GhostButton>
        {allRequirementsConfirmed ? (
          <PrimaryButton onClick={() => onStepChange(4)}>Tiếp tục sang Bước 4</PrimaryButton>
        ) : (
          <PrimaryButton disabled={busy || loadingStoryDrafts || !allStoryDraftsReady} onClick={() => void confirmAll()}>
            {busy ? "Đang xác nhận..." : "Xác nhận yêu cầu & sang Bước 4"}
          </PrimaryButton>
        )}
      </div>
      {!allStoryDraftsReady && draftRequirements.length > 0 && !loadingStoryDrafts && (
        <p className="text-right text-sm text-amber-700">
          Cần có bản nháp User Story cho mọi yêu cầu trước khi xác nhận.
        </p>
      )}
    </div>
  );
}
