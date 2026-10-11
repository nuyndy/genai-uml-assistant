import React from "react";
import {
  Card,
  EmptyState,
  PrimaryButton,
  SoftButton,
  StatusBadge,
  GhostButton,
  wrapClass,
} from "../ui/primitives";
import { FunctionalSpecificationEditor } from "../SpecificationEditor";
import { NonFunctionalSpecificationEditor } from "../SpecificationEditor";

export default function Buoc4DacTa(props) {
  const {
    stories,
    specifications,
    specDrafts,
    expandedFunctionalSpecifications,
    functionalSpecificationTabs,
    generatingStories,
    generatingNonFunctional,
    busy,
    onStepChange,
    generateFunctionalSpecification,
    createNonFunctionalSpecification,
    saveSpecification,
    setExpandedFunctionalSpecifications,
    setFunctionalSpecificationTabs,
    setSpecDrafts,
    requirementTitle,
    parseSpecification,
    emptyFunctionalSpecification,
    emptyNonFunctionalSpecification,
    FunctionalSpecification,
    NonFunctionalSpecification,
    } = props;
  // The implementation mirrors the original B4 JSX
  return (
    <div className="space-y-5">
      <Card tone="violet" title="Đặc tả chức năng">
        {stories.length === 0 ? (
          <EmptyState title="Chưa có user story" hint="Xác nhận yêu cầu ở Bước 3 trước." />
        ) : (
          <div className="space-y-4">
            {stories.map((story) => {
              const specification = specifications.find(
                (item) => item.user_story_id === story.id && item.type === "functional",
              );
              const isExpanded = expandedFunctionalSpecifications.includes(story.id);
              const functionalValue = specification
                ? (specDrafts[specification.id] as FunctionalSpecification | undefined) ??
                  parseSpecification(specification.content, emptyFunctionalSpecification())
                : emptyFunctionalSpecification();
              const activeTab = functionalSpecificationTabs[story.id] ?? "overview";
              return (
                <section
                  key={story.id}
                  className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Thu gọn" : "Mở"} đặc tả ${functionalValue.function_code || `UC${String(story.id).padStart(2, "0")}`}`}
                    onClick={() => setExpandedFunctionalSpecifications((previous) =>
                      isExpanded
                        ? previous.filter((id) => id !== story.id)
                        : [...previous, story.id]
                    )}
                    className="flex w-full min-w-0 items-center gap-3 p-4 text-left transition hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`block text-xs font-semibold uppercase tracking-wide text-violet-700 ${wrapClass}`}>
                        {functionalValue.function_code || `UC${String(story.id).padStart(2, "0")}`}
                      </span>
                      <span className={`mt-1 block font-semibold text-slate-900 ${wrapClass}`}>
                        {functionalValue.function_name || story.feature}
                      </span>
                    </span>
                    <StatusBadge tone={functionalValue.priority === "Must" ? "danger" : "info"}>
                      {functionalValue.priority}
                    </StatusBadge>
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
                            aria-label={`Các phần đặc tả ${functionalValue.function_code}`}
                          >
                            {([
                              ["overview", "Tổng quan"],
                              ["flows", "Luồng xử lý"],
                              ["business-data", "Nghiệp vụ & Dữ liệu"],
                            ] as const).map(([tab, label]) => (
                              <button
                                key={tab}
                                type="button"
                                role="tab"
                                aria-selected={activeTab === tab}
                                onClick={() => setFunctionalSpecificationTabs((previous) => ({
                                  ...previous,
                                  [story.id]: tab,
                                }))}
                                className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition ${
                                  activeTab === tab
                                    ? "border-violet-600 text-violet-700"
                                    : "border-transparent text-slate-500 hover:text-slate-800"
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
                                setSpecDrafts((previous) => ({ ...previous, [specification.id]: value }))
                              }
                            />
                            <div className="mt-5 flex flex-wrap justify-end gap-2">
                              <SoftButton disabled={busy} onClick={() => void generateFunctionalSpecification(story, true)}>
                                Tạo lại bằng AI
                              </SoftButton>
                              <PrimaryButton disabled={busy} onClick={() => void saveSpecification(specification, functionalValue)}>
                                Lưu thay đổi
                              </PrimaryButton>
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
                          <SoftButton disabled={busy || !props.projectId} onClick={() => void generateFunctionalSpecification(story)}>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GhostButton onClick={() => onStepChange(3)}>Quay lại Bước 3</GhostButton>
        <PrimaryButton
          disabled={busy || stories.length === 0 || stories.some((story) =>
            !specifications.some((item) => item.user_story_id === story.id && item.type === "functional")
          )}
          onClick={() => onStepChange(5)}
        >
          Tiếp tục sang Bước 5
        </PrimaryButton>
      </div>
      <div className="my-6 border-t border-slate-200" aria-hidden="true" />
      <Card tone="violet" title="Đặc tả phi chức năng">
        {(() => {
          const specification = specifications.find((item) => item.type === "non_functional");
          if (!specification) {
            return (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Tạo một lần theo 5 nhóm cố định. Sau đó có thể chỉnh sửa thủ công.
                </p>
                {generatingNonFunctional ? (
                  <p role="status" className="text-sm font-medium text-violet-700">
                    AI đang sinh đặc tả phi chức năng...
                  </p>
                ) : (
                  <SoftButton disabled={busy || !props.projectId} onClick={() => void createNonFunctionalSpecification()}>
                    Thử sinh bằng AI
                  </SoftButton>
                )}
              </div>
            );
          }
          return (
            <>
              <NonFunctionalSpecificationEditor
                value={
                  (specDrafts[specification.id] as NonFunctionalSpecification | undefined) ??
                  parseSpecification(specification.content, emptyNonFunctionalSpecification())
                }
                onChange={(value) =>
                  setSpecDrafts((previous) => ({ ...previous, [specification.id]: value }))
                }
              />
              <div className="mt-4 flex justify-end">
                <div className="flex flex-wrap justify-end gap-2">
                  <SoftButton disabled={busy} onClick={() => void createNonFunctionalSpecification(true)}>
                    Tạo lại bằng AI
                  </SoftButton>
                  <PrimaryButton disabled={busy} onClick={() => void saveSpecification(
                    specification,
                    specDrafts[specification.id] as NonFunctionalSpecification ??
                      parseSpecification(specification.content, emptyNonFunctionalSpecification())
                  )}>
                    Lưu thay đổi
                  </PrimaryButton>
                </div>
              </div>
            </>
          );
        })()}
      </Card>
    </div>
  );
}
