import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  Card,
  GhostButton,
  PrimaryButton,
  EmptyState,
  SoftButton,
} from "../../../common/ui/primitives";
import {
  FunctionalSpecificationEditor,
  NonFunctionalSpecificationEditor,
  emptyFunctionalSpecification,
  emptyNonFunctionalSpecification,
} from "../../../SpecificationEditor";
import type {
  FunctionalSpecification,
  NonFunctionalSpecification,
  SpecificationRecord,
  UserStory,
} from "../../../../services/requirementService";

type SpecDraft = FunctionalSpecification | NonFunctionalSpecification;

interface Props {
  projectId?: number;
  stories: UserStory[];
  specifications: SpecificationRecord[];
  expandedFunctionalSpecifications: number[];
  setExpandedFunctionalSpecifications: Dispatch<SetStateAction<number[]>>;
  functionalSpecificationTabs: Record<number, "overview" | "flows" | "business-data">;
  setFunctionalSpecificationTabs: Dispatch<SetStateAction<Record<number, "overview" | "flows" | "business-data">>>;
  specDrafts: Record<number, SpecDraft>;
  setSpecDrafts: Dispatch<SetStateAction<Record<number, SpecDraft>>>;
  generatingStories: Record<number, boolean>;
  generatingNonFunctional: boolean;
  busy: boolean;
  error?: string;
  generateFunctionalSpecification: (story: UserStory, regenerate?: boolean) => Promise<void>;
  saveSpecification: (specification: SpecificationRecord, content: SpecDraft) => Promise<void>;
  approveSpecification: (specification: SpecificationRecord) => Promise<void>;
  createNonFunctionalSpecification: (regenerate?: boolean) => Promise<void>;
  onStepChange: (step: number) => void;
  wrapClass: string;
  inputClass?: string;
}

const TABS = [
  ["overview", "Tổng quan"],
  ["flows", "Luồng xử lý"],
  ["business-data", "Nghiệp vụ & Dữ liệu"],
] as const;

function parseSpecification<T>(content: string, fallback: T): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

type BadgeTone = "danger" | "info";

const BADGE_COLORS: Record<BadgeTone, string> = {
  danger: "bg-rose-100 text-rose-700",
  info: "bg-blue-100 text-blue-700",
};

function PriorityBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_COLORS[tone]}`}>
      {children}
    </span>
  );
}

export default function Step4DacTa({
  projectId,
  stories,
  specifications,
  expandedFunctionalSpecifications,
  setExpandedFunctionalSpecifications,
  functionalSpecificationTabs,
  setFunctionalSpecificationTabs,
  specDrafts,
  setSpecDrafts,
  generatingStories,
  generatingNonFunctional,
  busy,
  error,
  generateFunctionalSpecification,
  saveSpecification,
  approveSpecification,
  createNonFunctionalSpecification,
  onStepChange,
  wrapClass,
}: Props) {
  const nonFunctionalSpecification = specifications.find(
    (item) => item.type === "non_functional",
  );

  const allFunctionalReady =
    stories.length > 0 &&
    stories.every((story) =>
      specifications.some(
        (item) => item.user_story_id === story.id && item.type === "functional",
      ),
    );
  const canContinue = allFunctionalReady && Boolean(nonFunctionalSpecification) && !busy;

  return (
    <div className="w-full min-w-0 space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-100 via-white to-amber-100 p-5 sm:p-7">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-900">Giai đoạn 1 · Đặc tả yêu cầu</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Đặc tả chức năng &amp; phi chức năng</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Sinh đặc tả từ User Story đã xác nhận, rà soát luồng xử lý và yêu cầu chất lượng, sau đó lưu để đồng bộ vào bản nháp SRS ở bước rà soát.</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-sm font-bold text-emerald-800">04</span><span><span className="block text-sm font-semibold text-slate-900">Xây dựng đặc tả</span><span className="block text-xs text-slate-500">Bước 4 / 5</span></span></div>
        </div>
      </section>
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      <Card tone="emerald" title="Đặc tả chức năng">
        {stories.length === 0 ? (
          <EmptyState title="Chưa có user story" hint="Xác nhận yêu cầu ở Bước 3 trước." />
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-2">
            {stories.map((story) => {
              const specification = specifications.find(
                (item) => item.user_story_id === story.id && item.type === "functional",
              );
              const isExpanded = expandedFunctionalSpecifications.includes(story.id);
              const functionalValue: FunctionalSpecification = specification
                ? ((specDrafts[specification.id] as FunctionalSpecification | undefined) ??
                  parseSpecification(specification.content, emptyFunctionalSpecification()))
                : emptyFunctionalSpecification();
              const code =
                functionalValue.function_code || `UC${String(story.id).padStart(2, "0")}`;
              const activeTab = functionalSpecificationTabs[story.id] ?? "overview";

              return (
                <section
                  key={story.id}
                  className="min-w-0 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Thu gọn" : "Mở"} đặc tả ${code}`}
                    onClick={() =>
                      setExpandedFunctionalSpecifications((previous) =>
                        isExpanded
                          ? previous.filter((id) => id !== story.id)
                          : [...previous, story.id],
                      )
                    }
                    className="flex w-full min-w-0 items-center gap-3 p-4 text-left transition hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-xs font-semibold uppercase tracking-wide text-emerald-800 ${wrapClass}`}
                      >
                        {code}
                      </span>
                      <span className={`mt-1 block font-semibold text-slate-900 ${wrapClass}`}>
                        {functionalValue.function_name || story.feature}
                      </span>
                    </span>
                    {functionalValue.priority && (
                      <PriorityBadge tone={functionalValue.priority === "Must" ? "danger" : "info"}>
                        {functionalValue.priority}
                      </PriorityBadge>
                    )}
                    <span aria-hidden="true" className="shrink-0 text-lg text-slate-500">
                      {isExpanded ? "⌃" : "⌄"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="min-w-0 border-t border-slate-200">
                      {specification ? (
                        <>
                          <div
                            className="flex max-w-full gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-3"
                            role="tablist"
                            aria-label={`Các phần đặc tả ${code}`}
                          >
                            {TABS.map(([tab, label]) => (
                              <button
                                key={tab}
                                type="button"
                                role="tab"
                                aria-selected={activeTab === tab}
                                onClick={() =>
                                  setFunctionalSpecificationTabs((previous) => ({
                                    ...previous,
                                    [story.id]: tab,
                                  }))
                                }
                                className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition ${
                                  activeTab === tab
                                    ? "border-emerald-700 text-emerald-900"
                                    : "border-transparent text-slate-600 hover:bg-emerald-50 hover:text-emerald-900"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <div className="min-w-0 p-5" role="tabpanel">
                            <FunctionalSpecificationEditor
                              value={functionalValue}
                              activeTab={activeTab}
                              onChange={(value) =>
                                setSpecDrafts((previous) => ({
                                  ...previous,
                                  [specification.id]: value,
                                }))
                              }
                            />
                            <div className="mt-5 flex flex-wrap justify-end gap-2">
                              <SoftButton
                                disabled={busy}
                                onClick={() => void generateFunctionalSpecification(story, true)}
                              >
                                Tạo lại bằng AI
                              </SoftButton>
                              <PrimaryButton
                                disabled={busy}
                                onClick={() => void saveSpecification(specification, functionalValue)}
                              >
                                Lưu thay đổi
                              </PrimaryButton>
                              <SoftButton
                                disabled={busy || specification.approval_status === "approved"}
                                onClick={() => void approveSpecification(specification)}
                              >
                                {specification.approval_status === "approved" ? "Đã duyệt" : "Duyệt đặc tả"}
                              </SoftButton>
                            </div>
                            <p className="mt-2 text-right text-xs text-slate-500">
                              Phiên bản {specification.version}. Có thể sửa trực tiếp các trường.
                            </p>
                          </div>
                        </>
                      ) : generatingStories[story.id] ? (
                        <p role="status" className="p-5 text-sm font-medium text-violet-700">
                          AI đang sinh đặc tả chức năng...
                        </p>
                      ) : (
                        <div className="p-5">
                          <SoftButton
                            disabled={busy || !projectId}
                            onClick={() => void generateFunctionalSpecification(story)}
                          >
                            Thử sinh bằng AI
                          </SoftButton>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Card>

      <Card tone="emerald" title="Đặc tả phi chức năng">
        {!nonFunctionalSpecification ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Tạo một lần theo 5 nhóm cố định. Sau đó có thể chỉnh sửa thủ công.
            </p>
            {generatingNonFunctional ? (
              <p role="status" className="text-sm font-medium text-violet-700">
                AI đang sinh đặc tả phi chức năng...
              </p>
            ) : (
              <SoftButton
                disabled={busy || !projectId}
                onClick={() => void createNonFunctionalSpecification()}
              >
                Thử sinh bằng AI
              </SoftButton>
            )}
          </div>
        ) : (
          (() => {
            const nonFunctionalValue: NonFunctionalSpecification =
              (specDrafts[nonFunctionalSpecification.id] as NonFunctionalSpecification | undefined) ??
              parseSpecification(
                nonFunctionalSpecification.content,
                emptyNonFunctionalSpecification(),
              );
            return (
              <>
                <NonFunctionalSpecificationEditor
                  value={nonFunctionalValue}
                  onChange={(value) =>
                    setSpecDrafts((previous) => ({
                      ...previous,
                      [nonFunctionalSpecification.id]: value,
                    }))
                  }
                />
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <SoftButton
                    disabled={busy}
                    onClick={() => void createNonFunctionalSpecification(true)}
                  >
                    Tạo lại bằng AI
                  </SoftButton>
                  <PrimaryButton
                    disabled={busy}
                    onClick={() =>
                      void saveSpecification(nonFunctionalSpecification, nonFunctionalValue)
                    }
                  >
                    Lưu thay đổi
                  </PrimaryButton>
                  <SoftButton
                    disabled={busy || nonFunctionalSpecification.approval_status === "approved"}
                    onClick={() => void approveSpecification(nonFunctionalSpecification)}
                  >
                    {nonFunctionalSpecification.approval_status === "approved" ? "Đã duyệt" : "Duyệt đặc tả"}
                  </SoftButton>
                </div>
              </>
            );
          })()
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <GhostButton onClick={() => onStepChange(3)}>Quay lại Bước 3</GhostButton>
        <PrimaryButton disabled={!canContinue} onClick={() => onStepChange(5)}>
          Tiếp tục sang Bước 5
        </PrimaryButton>
          {!canContinue && <p className="max-w-sm text-right text-xs text-amber-800">Cần tạo đặc tả chức năng cho mọi User Story và đặc tả phi chức năng trước khi tiếp tục.</p>}
      </div>
    </div>
  );
}