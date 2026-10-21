import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Card, EmptyState, PrimaryButton, SoftButton, StatusBadge } from "../../../common/ui/primitives";
import {
  FunctionalSpecificationEditor,
  NonFunctionalSpecificationEditor,
  emptyFunctionalSpecification,
  emptyNonFunctionalSpecification,
} from "../../../SpecificationEditor";
import {
  deleteSpecification,
  type FunctionalSpecification,
  type NonFunctionalSpecification,
  type SpecificationRecord,
  type UserStory,
} from "../../../../services/requirementService";

type SpecDraft = FunctionalSpecification | NonFunctionalSpecification;
type SpecKind = "functional" | "non_functional";

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
  generateFunctionalSpecification: (story: UserStory, regenerate?: boolean, skipRegenerationConfirmation?: boolean) => Promise<void>;
  saveSpecification: (specification: SpecificationRecord, content: SpecDraft) => Promise<void>;
  approveSpecification: (specification: SpecificationRecord) => Promise<void>;
  createNonFunctionalSpecification: (regenerate?: boolean, skipRegenerationConfirmation?: boolean) => Promise<void>;
  onStepChange: (step: number) => void;
  wrapClass: string;
  inputClass?: string;
}

function parseSpecification<T>(content: string, fallback: T): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

export default function Step4DacTa({
  projectId,
  stories,
  specifications,
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
  const [kind, setKind] = useState<SpecKind>("functional");
  const [activeIndex, setActiveIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const functionalItems = useMemo(
    () => stories.map((story) => ({
      story,
      specification: specifications.find((item) => item.user_story_id === story.id && item.type === "functional"),
    })),
    [stories, specifications],
  );
  const nonFunctionalSpecification = specifications.find((item) => item.type === "non_functional");
  const activeFunctional = functionalItems[activeIndex];
  const activeStory = activeFunctional?.story;
  const activeSpecification = kind === "functional" ? activeFunctional?.specification : nonFunctionalSpecification;
  const activeFunctionalValue: FunctionalSpecification = activeFunctional?.specification
    ? (specDrafts[activeFunctional.specification.id] as FunctionalSpecification | undefined)
      ?? parseSpecification(activeFunctional.specification.content, emptyFunctionalSpecification())
    : emptyFunctionalSpecification();
  const activeNonFunctionalValue: NonFunctionalSpecification = nonFunctionalSpecification
    ? (specDrafts[nonFunctionalSpecification.id] as NonFunctionalSpecification | undefined)
      ?? parseSpecification(nonFunctionalSpecification.content, emptyNonFunctionalSpecification())
    : emptyNonFunctionalSpecification();
  const activeTab = activeStory ? functionalSpecificationTabs[activeStory.id] ?? "overview" : "overview";
  const itemCount = kind === "functional" ? functionalItems.length : (nonFunctionalSpecification ? 1 : 0);
  const canContinue = stories.length > 0
    && functionalItems.every((item) => Boolean(item.specification))
    && Boolean(nonFunctionalSpecification)
    && !busy;

  useEffect(() => {
    if (activeIndex >= Math.max(functionalItems.length, 1)) setActiveIndex(Math.max(functionalItems.length - 1, 0));
  }, [activeIndex, functionalItems.length]);

  const chooseKind = (nextKind: SpecKind) => {
    setKind(nextKind);
    setActiveIndex(0);
    setActionMessage("");
  };

  const regenerateAllSpecifications = async () => {
    if (!projectId || busy || regeneratingAll || stories.length === 0) return;
    const confirmed = window.confirm(
      "AI sẽ sinh lại toàn bộ FR cho các User Story và NFR của dự án. Nội dung đặc tả đã lưu có thể bị thay thế. Bạn nên lưu các chỉnh sửa trước khi tiếp tục. Bạn có muốn thực hiện không?",
    );
    if (!confirmed) return;

    setRegeneratingAll(true);
    setActionMessage("");
    try {
      for (const story of stories) {
        await generateFunctionalSpecification(story, true, true);
      }
      await createNonFunctionalSpecification(true, true);
      setActionMessage("Đã gửi yêu cầu sinh lại toàn bộ FR/NFR.");
    } catch (reason) {
      setActionMessage(reason instanceof Error ? reason.message : "Không thể sinh lại toàn bộ FR/NFR.");
    } finally {
      setRegeneratingAll(false);
    }
  };

  const removeActiveSpecification = async () => {
    if (!activeSpecification || deleting || busy) return;
    const label = kind === "functional" ? "đặc tả chức năng" : "đặc tả phi chức năng";
    if (!window.confirm(`Bạn có chắc muốn xóa ${label} này không? Thao tác này không thể hoàn tác.`)) return;
    setDeleting(true);
    setActionMessage("");
    try {
      await deleteSpecification(activeSpecification.id);
      setSpecDrafts((previous) => {
        const next = { ...previous };
        delete next[activeSpecification.id];
        return next;
      });
      setActionMessage("Đã xóa đặc tả. Đang tải lại danh sách...");
      window.location.reload();
    } catch (reason) {
      setActionMessage(reason instanceof Error ? reason.message : "Không thể xóa đặc tả.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-[#C8DDD7] bg-white p-3 shadow-sm lg:sticky lg:top-4">
          <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Loại đặc tả</p>
          <button type="button" onClick={() => chooseKind("functional")} aria-pressed={kind === "functional"}
            className={`mb-2 flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${kind === "functional" ? "border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
            <span><span className="block text-sm font-bold">FR</span><span className="mt-0.5 block text-xs opacity-75">Chức năng</span></span>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold">{functionalItems.length}</span>
          </button>
          <button type="button" onClick={() => chooseKind("non_functional")} aria-pressed={kind === "non_functional"}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${kind === "non_functional" ? "border-violet-500 bg-violet-50 text-violet-900 shadow-sm" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
            <span><span className="block text-sm font-bold">NFR</span><span className="mt-0.5 block text-xs opacity-75">Phi chức năng</span></span>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold">{nonFunctionalSpecification ? 1 : 0}</span>
          </button>
          <div className="mt-3 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={() => void regenerateAllSpecifications()}
              disabled={!projectId || stories.length === 0 || busy || regeneratingAll || Boolean(Object.values(generatingStories).some(Boolean)) || generatingNonFunctional}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-3 py-3 text-sm font-semibold text-violet-900 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {regeneratingAll ? <><span className="animate-spin">⟳</span> Đang sinh lại...</> : "Sinh lại toàn bộ"}
            </button>
            <p className="mt-2 px-1 text-xs leading-5 text-slate-500">Sinh lại tất cả FR và NFR bằng AI.</p>
          </div>
        </aside>

        <section className="min-w-0">
          {kind === "functional" ? (
            !activeStory ? (
              <Card title="Danh sách FR"><EmptyState title="Chưa có User Story" hint="Hãy hoàn tất Bước 3 để tạo các đặc tả chức năng." /></Card>
            ) : (
              <article className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-emerald-200 bg-emerald-50 px-3 py-2">
                  <SoftButton disabled={activeIndex === 0 || busy} onClick={() => { setActiveIndex((index) => Math.max(0, index - 1)); setActionMessage(""); }}>← Trước</SoftButton>
                  <span className="text-xs font-medium text-slate-600">FR {functionalItems.length ? activeIndex + 1 : 0}/{functionalItems.length}</span>
                  <SoftButton disabled={activeIndex >= functionalItems.length - 1 || busy} onClick={() => { setActiveIndex((index) => Math.min(functionalItems.length - 1, index + 1)); setActionMessage(""); }}>Sau →</SoftButton>
                </div>
                <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                    <p className={`text-sm font-bold uppercase tracking-wide text-emerald-800 ${wrapClass}`}>FR · US-{String(activeStory.id).padStart(3, "0")}{activeSpecification ? ` · SPEC-${String(activeSpecification.id).padStart(3, "0")}` : ""}</p>
                    <h2 className={`text-lg font-semibold text-slate-900 ${wrapClass}`}>{activeFunctionalValue.function_name || activeStory.feature}</h2>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge tone={activeSpecification ? "success" : "warn"}>{activeSpecification ? "Đã tạo đặc tả" : "Chưa có đặc tả"}</StatusBadge>
                      {activeSpecification && <StatusBadge tone={activeSpecification.approval_status === "approved" ? "success" : "warn"}>{activeSpecification.approval_status === "approved" ? "Đã duyệt" : "Chưa duyệt"}</StatusBadge>}
                      {activeSpecification && <StatusBadge tone="neutral">Phiên bản {activeSpecification.version}</StatusBadge>}
                    </div>
                  </div>
                </header>
                {!activeSpecification ? (
                  <div className="p-5">
                    {generatingStories[activeStory.id] ? <p role="status" className="text-sm font-medium text-violet-700">AI đang sinh đặc tả chức năng...</p> : <p className="mb-3 text-sm text-slate-600">Chưa có nội dung FR cho User Story này.</p>}
                    <SoftButton disabled={busy || !projectId || Boolean(generatingStories[activeStory.id])} onClick={() => void generateFunctionalSpecification(activeStory)}>Tạo FR bằng AI</SoftButton>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 p-4 sm:p-5" role="tabpanel">
                      <FunctionalSpecificationEditor value={activeFunctionalValue} activeTab={activeTab} onChange={(value) => setSpecDrafts((previous) => ({ ...previous, [activeSpecification.id]: value }))} />
                    </div>
                  </>
                )}
                <footer className="flex flex-row flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-emerald-100/80 px-3 py-2">
                  <div className="flex flex-row flex-wrap items-center gap-2">
                    <SoftButton disabled={!activeSpecification || busy || deleting} onClick={() => void removeActiveSpecification()}>{deleting ? "Đang xóa..." : "Xóa FR"}</SoftButton>
                  </div>
                  <div className="flex flex-row flex-wrap items-center gap-2">
                    {activeSpecification && <>
                      <SoftButton disabled={busy} onClick={() => void generateFunctionalSpecification(activeStory, true)}>Tạo lại bằng AI</SoftButton>
                      <PrimaryButton disabled={busy} onClick={() => void saveSpecification(activeSpecification, activeFunctionalValue)}>Lưu</PrimaryButton>
                      <SoftButton disabled={busy || activeSpecification.approval_status === "approved"} onClick={() => void approveSpecification(activeSpecification)}>{activeSpecification.approval_status === "approved" ? "Đã duyệt" : "Duyệt"}</SoftButton>
                    </>}
                  </div>
                </footer>
                {actionMessage && <p role="status" className="px-4 py-3 text-sm text-slate-600">{actionMessage}</p>}
              </article>
            )
          ) : (
            <article className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-violet-200 bg-violet-50 px-3 py-2">
                <SoftButton disabled={busy} onClick={() => { chooseKind("functional"); setActiveIndex(Math.max(functionalItems.length - 1, 0)); }}>← Trước</SoftButton>
                <span className="text-xs font-medium text-slate-600">NFR</span>
                <SoftButton disabled={!canContinue} onClick={() => onStepChange(5)}>Sau →</SoftButton>
              </div>
              <header className="border-b border-slate-200 bg-violet-50/70 px-4 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="text-sm font-bold uppercase tracking-wide text-violet-800">NFR · ĐẶC TẢ PHI CHỨC NĂNG</p>
                  <h2 className="text-lg font-semibold text-slate-900">Yêu cầu chất lượng hệ thống</h2>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge tone={nonFunctionalSpecification ? "success" : "warn"}>{nonFunctionalSpecification ? "Đã tạo đặc tả" : "Chưa có đặc tả"}</StatusBadge>
                    {nonFunctionalSpecification && <StatusBadge tone={nonFunctionalSpecification.approval_status === "approved" ? "success" : "warn"}>{nonFunctionalSpecification.approval_status === "approved" ? "Đã duyệt" : "Chưa duyệt"}</StatusBadge>}
                    {nonFunctionalSpecification && <StatusBadge tone="neutral">Phiên bản {nonFunctionalSpecification.version}</StatusBadge>}
                  </div>
                </div>
              </header>
              {!nonFunctionalSpecification ? (
                <div className="p-5">
                  <p className="mb-3 text-sm text-slate-600">Tạo đặc tả phi chức năng theo các nhóm hiện có của hệ thống, sau đó có thể chỉnh sửa và lưu.</p>
                  {generatingNonFunctional ? <p role="status" className="mb-3 text-sm font-medium text-violet-700">AI đang sinh đặc tả phi chức năng...</p> : <SoftButton disabled={busy || !projectId} onClick={() => void createNonFunctionalSpecification()}>Tạo NFR bằng AI</SoftButton>}
                </div>
              ) : (
                <div className="min-w-0 p-4 sm:p-5">
                  <NonFunctionalSpecificationEditor value={activeNonFunctionalValue} onChange={(value) => setSpecDrafts((previous) => ({ ...previous, [nonFunctionalSpecification.id]: value }))} />

                </div>
              )}
              <footer className="flex flex-row flex-nowrap items-center justify-between gap-2 border-t border-slate-200 bg-violet-100/80 px-3 py-2">
                <div className="flex flex-row flex-nowrap items-center gap-2">
                  <SoftButton disabled={!nonFunctionalSpecification || busy || deleting} onClick={() => void removeActiveSpecification()}>{deleting ? "Đang xóa..." : "Xóa NFR"}</SoftButton>
                </div>
                <div className="flex flex-row flex-nowrap items-center gap-2">
                  <SoftButton disabled={busy || !nonFunctionalSpecification} onClick={() => void createNonFunctionalSpecification(true)}>Tạo lại bằng AI</SoftButton>
                  <PrimaryButton disabled={!nonFunctionalSpecification || busy} onClick={() => nonFunctionalSpecification && void saveSpecification(nonFunctionalSpecification, activeNonFunctionalValue)}>Lưu</PrimaryButton>
                  <SoftButton disabled={!nonFunctionalSpecification || busy || nonFunctionalSpecification.approval_status === "approved"} onClick={() => nonFunctionalSpecification && void approveSpecification(nonFunctionalSpecification)}>{nonFunctionalSpecification?.approval_status === "approved" ? "Đã duyệt" : "Duyệt"}</SoftButton>
                </div>
              </footer>
              {actionMessage && <p role="status" className="px-4 py-3 text-sm text-slate-600">{actionMessage}</p>}
            </article>
          )}
        </section>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <SoftButton disabled={busy} onClick={() => onStepChange(3)}>← Quay lại Bước 3</SoftButton>
        <p className="text-xs text-slate-500">Đang xem {kind === "functional" ? `FR ${Math.min(activeIndex + 1, Math.max(itemCount, 1))}/${itemCount}` : "NFR"}</p>
        <PrimaryButton disabled={!canContinue} onClick={() => onStepChange(5)}>Lưu và sang Bước 5 →</PrimaryButton>
      </div>
    </div>
  );
}
