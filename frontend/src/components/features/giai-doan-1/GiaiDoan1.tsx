import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  approveSpecification,
  checkProjectRequirementCoverage,
  confirmProjectRequirementsBatch,
  createRequirement,
  createProjectRequirementsBatch,
  deleteRequirement,
  generateNonFunctionalSpecification,
  generateProjectSpecificationsBatch,
  consolidateProjectFunctionalSpecifications,
  getFunctionalConsolidationStatus,
  getSpecificationDocument,
  listProjectRequirements,
  listProjectSpecifications,
  listProjectUserStories,
  previewProjectUserStories,
  saveSrsMetadata,
  generateSrsMetadata,
  updateSpecification,
  type FunctionalSpecification,
  type NonFunctionalSpecification,
  type RequirementCoverageAnalysis,
  type RequirementCoverageSuggestion,
  type RequirementPayload,
  type RequirementRecord,
  type SpecificationRecord,
  type SrsMetadata,
  type UserStory,
  type UserStoryDraft,
} from "../../common/services/requirementService";
import type { RawRequirement, SpecDoc, WorkflowState } from "../../common/types/workflow";
import Step1NhapYeuCau from "./steps/Step1NhapYeuCau";
import Step2PhanTichYeuCau from "./steps/Step2PhanTichYeuCau";
import Step3UserStory from "./steps/Step3UserStory";
import Step4DacTa from "./steps/Step4DacTa";
import Step5ChotTaiLieu from "./steps/Step5ChotTaiLieu";
import ProgressOverlay from "../../common/ProgressOverlay";
import {
  emptyFunctionalSpecification,
  emptyNonFunctionalSpecification,
} from "../../SpecificationEditor";
import { inputClass, wrapClass } from "../../common/ui/primitives";
import { getProjectUmlState } from "../../common/services/umlService";

interface Props {
  projectId?: number;
  projectName?: string;
  state: WorkflowState;
  setState: (updater: (prev: WorkflowState) => WorkflowState) => void;
  step: number;
  onStepChange: (step: number) => void;
}

type RequirementTextField = Exclude<keyof RawRequirement, "preConditions" | "businessRules">;

const emptyRequirement = (): RawRequirement => ({
  actor: "",
  action: "",
  targetObject: "",
  purpose: "",
  preConditions: [],
  businessRules: [],
});

function toPayload(raw: RawRequirement): RequirementPayload {
  return {
    actor: raw.actor.trim(),
    action: raw.action.trim(),
    target_object: raw.targetObject.trim(),
    purpose: raw.purpose.trim(),
    pre_conditions: raw.preConditions.map((item) => item.trim()).filter(Boolean),
    business_rules: raw.businessRules.map((item) => item.trim()).filter(Boolean),
  };
}

function parseRequirement(content: string): RawRequirement {
  const value: unknown = JSON.parse(content);
  if (!value || typeof value !== "object") {
    throw new Error("Dữ liệu yêu cầu trong cơ sở dữ liệu không hợp lệ.");
  }
  const data = value as Record<string, unknown>;
  const required = ["actor", "action", "target_object", "purpose"];
  if (required.some((key) => typeof data[key] !== "string")) {
    throw new Error("Dữ liệu yêu cầu trong cơ sở dữ liệu thiếu trường bắt buộc.");
  }
  const asStringList = (item: unknown, label: string): string[] => {
    if (item === undefined) return [];
    if (!Array.isArray(item) || item.some((entry) => typeof entry !== "string")) {
      throw new Error(`Danh sách ${label} trong yêu cầu không hợp lệ.`);
    }
    return item;
  };
  return {
    actor: data.actor as string,
    action: data.action as string,
    targetObject: data.target_object as string,
    purpose: data.purpose as string,
    preConditions: asStringList(data.pre_conditions, "điều kiện trước"),
    businessRules: asStringList(data.business_rules, "quy tắc nghiệp vụ"),
  };
}

function toSpecDoc(specification: SpecificationRecord): SpecDoc {
  return {
    id: specification.id,
    userStoryId: specification.user_story_id ?? undefined,
    feature: specification.feature,
    type: specification.type,
    content: specification.content,
    approved: specification.approval_status === "approved",
    version: specification.version,
  };
}

function formatError(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Đã xảy ra lỗi không xác định.";
}

function requirementTitle(raw: RawRequirement): string {
  return `${raw.actor}: ${raw.action} ${raw.targetObject}`.trim();
}

function parseSpecification<T>(content: string, fallback: T): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

const META_KEYS: (keyof SrsMetadata)[] = [
  "intro_purpose",
  "intro_scope",
  "intro_definitions",
  "overview_user_classes",
  "overview_environment",
  "appendix_notes",
];

export default function GiaiDoan1({
  projectId,
  projectName,
  state,
  setState,
  step,
  onStepChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [aiTaskLabel, setAiTaskLabel] = useState("");
  const [aiTaskDetails, setAiTaskDetails] = useState("");
  const [loaded, setLoaded] = useState(!projectId);
  const [appendixReady, setAppendixReady] = useState(false);
  const [requirements, setRequirements] = useState<RequirementRecord[]>([]);
  const [requirementValues, setRequirementValues] = useState<Record<number, RawRequirement>>({});
  const [coverageAnalysis, setCoverageAnalysis] = useState<RequirementCoverageAnalysis | null>(null);
  const [selectedCoverageSuggestions, setSelectedCoverageSuggestions] =
    useState<Record<number, boolean>>({});
  const [addedCoverageSuggestions, setAddedCoverageSuggestions] = useState<number[]>([]);
  const [coverageAddedCount, setCoverageAddedCount] = useState(0);
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [newRequirement, setNewRequirement] = useState(state.rawRequirement);
  const [stories, setStories] = useState<UserStory[]>([]);
  const [storyDrafts, setStoryDrafts] = useState<Record<number, UserStoryDraft>>({});
  const [storyDraftsEdited, setStoryDraftsEdited] = useState(false);
  const [loadingStoryDrafts, setLoadingStoryDrafts] = useState(false);
  const [specifications, setSpecifications] = useState<SpecificationRecord[]>(
    projectId
      ? []
      : state.specs.map((item) => ({
          id: item.id,
          user_story_id: item.userStoryId ?? null,
          feature: item.feature,
          type: item.type,
          content: item.content,
          version: item.version ?? 1,
          approval_status: item.approved ? "approved" : "draft",
        })),
  );
  const [specDrafts, setSpecDrafts] = useState<
    Record<number, FunctionalSpecification | NonFunctionalSpecification>
  >({});
  const [expandedFunctionalSpecifications, setExpandedFunctionalSpecifications] = useState<number[]>([]);
  const [functionalSpecificationTabs, setFunctionalSpecificationTabs] =
    useState<Record<number, "overview" | "flows" | "business-data">>({});
  const [generatingStories, setGeneratingStories] = useState<Record<number, boolean>>({});
  const [generatingNonFunctional, setGeneratingNonFunctional] = useState(false);
  const [srsMarkdown, setSrsMarkdown] = useState("");
  const [srsMetadata, setSrsMetadata] = useState<SrsMetadata>({
    intro_purpose: "",
    intro_scope: "",
    intro_definitions: "",
    overview_user_classes: "",
    overview_environment: "",
    appendix_notes: "",
  });
  const [srsMetadataSaved, setSrsMetadataSaved] = useState<SrsMetadata | null>(null);
  const [srsSpecDrafts, setSrsSpecDrafts] = useState<
    Record<number, FunctionalSpecification | NonFunctionalSpecification>
  >({});
  const autoGeneratedStoryProjects = useRef(new Set<number>());
  const generationInFlight = useRef(new Set<string>());


  useEffect(() => {
    if (!projectId || !aiTaskLabel.includes("tổng hợp User Story")) {
      setAiTaskDetails("");
      return;
    }

    let cancelled = false;
    let polling = false;
    const pollStatus = async () => {
      if (polling) return;
      polling = true;
      try {
        const status = await getFunctionalConsolidationStatus(projectId);
        if (cancelled) return;
        const progress = status.total_batches > 0
          ? `Đã hoàn thành ${status.completed_batches}/${status.total_batches} nhóm. `
          : "";
        setAiTaskDetails(progress + status.status_message);
      } catch {
        if (!cancelled) {
          setAiTaskDetails("Đang chờ backend cập nhật tiến trình AI...");
        }
      } finally {
        polling = false;
      }
    };

    setAiTaskDetails("Đang khởi tạo tiến trình tổng hợp...");
    void pollStatus();
    const timer = window.setInterval(() => void pollStatus(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [projectId, aiTaskLabel]);

  const draftRequirements = useMemo(
    () => requirements.filter((item) => item.status === "draft"),
    [requirements],
  );
  const draftIdsKey = draftRequirements.map((item) => item.id).join(",");
  const allStoryDraftsReady =
    draftRequirements.length > 0 &&
    draftRequirements.every((item) => {
      const story = storyDrafts[item.id];
      return story !== undefined && [
        story.role,
        story.feature,
        story.benefit,
        story.acceptance_criteria,
      ].every((value) => value.trim().length > 0);
    });
  const allRequirementsConfirmed =
    requirements.length > 0 && requirements.every((item) => item.status === "confirmed");

  const syncSpecifications = useCallback(
    (records: SpecificationRecord[]) => {
      setSpecifications(records);
      setState((previous) => ({ ...previous, specs: records.map(toSpecDoc) }));
    },
    [setState],
  );

  const resetCoverage = () => {
    setCoverageAnalysis(null);
    setSelectedCoverageSuggestions({});
    setAddedCoverageSuggestions([]);
    setCoverageAddedCount(0);
  };

  const refreshProjectData = useCallback(async () => {
    if (!projectId) return;
    const [requirementRecords, storyRecords, specificationRecords] = await Promise.all([
      listProjectRequirements(projectId),
      listProjectUserStories(projectId),
      listProjectSpecifications(projectId),
    ]);
    const parsed = Object.fromEntries(
      requirementRecords.map((item) => [item.id, parseRequirement(item.content)]),
    );
    setCoverageAnalysis(null);
    setSelectedCoverageSuggestions({});
    setAddedCoverageSuggestions([]);
    setRequirements(requirementRecords);
    setRequirementValues(parsed);
    setStories(storyRecords);
    syncSpecifications(specificationRecords);
  }, [projectId, syncSpecifications]);

  const refreshSpecifications = useCallback(async () => {
    if (!projectId) return [];
    const records = await listProjectSpecifications(projectId);
    syncSpecifications(records);
    return records;
  }, [projectId, syncSpecifications]);

  const refreshSrsDocument = useCallback(async () => {
    if (!projectId) return;
    const document = await getSpecificationDocument(projectId);
    setSrsMarkdown(document.raw_markdown);
    setSrsMetadata(document.metadata);
    setSrsMetadataSaved(document.metadata);
    setSrsSpecDrafts({});
  }, [projectId]);

  // Tải dữ liệu giai đoạn 1 khi đổi dự án.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoaded(false);
    void (async () => {
      try {
        const [requirementRecords, storyRecords, specificationRecords] = await Promise.all([
          listProjectRequirements(projectId),
          listProjectUserStories(projectId),
          listProjectSpecifications(projectId),
        ]);
        if (cancelled) return;
        const parsed = Object.fromEntries(
          requirementRecords.map((item) => [item.id, parseRequirement(item.content)]),
        );
        setCoverageAnalysis(null);
        setSelectedCoverageSuggestions({});
        setAddedCoverageSuggestions([]);
        setCoverageAddedCount(0);
        setRequirements(requirementRecords);
        setRequirementValues(parsed);
        setStories(storyRecords);
        syncSpecifications(specificationRecords);
        setNewRequirement(emptyRequirement());

        // Một nguồn duy nhất cho userStoryId: ưu tiên story của yêu cầu mới nhất,
        // nếu không có thì lấy story đầu tiên của dự án.
        const latest = requirementRecords.at(-1);
        setState((previous) => ({
          ...previous,
          requirementId: latest?.id ?? null,
          userStoryId: latest?.user_story?.id ?? storyRecords[0]?.id ?? null,
          rawRequirement: latest ? (parsed[latest.id] ?? emptyRequirement()) : emptyRequirement(),
          requirementLocked: latest?.status === "confirmed",
        }));
      } catch (reason) {
        if (!cancelled) setError(`Không thể tải dữ liệu giai đoạn 1: ${formatError(reason)}`);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, syncSpecifications, setState]);


  const changeNewField = (field: RequirementTextField, value: string) => {
    setNewRequirement((previous) => ({ ...previous, [field]: value }));
  };

  const changeNewList = (field: "preConditions" | "businessRules", value: string[]) => {
    setNewRequirement((previous) => ({ ...previous, [field]: value }));
  };

  const addRequirement = async () => {
    if (
      !newRequirement.actor.trim() ||
      !newRequirement.action.trim() ||
      !newRequirement.targetObject.trim() ||
      !newRequirement.purpose.trim()
    ) {
      setError("Vui lòng nhập vai trò, hành động, đối tượng và mục đích.");
      return;
    }
    if (!projectId) {
      setError("Không thể lưu yêu cầu vì dự án chưa được tải từ cơ sở dữ liệu.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await createRequirement(projectId, toPayload(newRequirement));
      const record: RequirementRecord = {
        id: created.id,
        project_id: projectId,
        content: JSON.stringify(toPayload(newRequirement)),
        status: "draft",
        user_story: null,
      };
      setRequirements((previous) => [...previous, record]);
      resetCoverage();
      setRequirementValues((previous) => ({ ...previous, [created.id]: newRequirement }));
      setNewRequirement(emptyRequirement());
      setState((previous) => ({
        ...previous,
        rawRequirement: emptyRequirement(),
        requirementId: created.id,
        analysis: null,
      }));
    } catch (reason) {
      setError(`Không thể lưu yêu cầu: ${formatError(reason)}`);
    } finally {
      setBusy(false);
    }
  };

  const removeRequirement = async (requirementId: number) => {
    setBusy(true);
    setError("");
    try {
      await deleteRequirement(requirementId);
      setRequirements((previous) => previous.filter((item) => item.id !== requirementId));
      resetCoverage();
      setRequirementValues((previous) => {
        const next = { ...previous };
        delete next[requirementId];
        return next;
      });
    } catch (reason) {
      setError(`Không thể xóa yêu cầu: ${formatError(reason)}`);
    } finally {
      setBusy(false);
    }
  };

  const checkRequirementCoverage = async () => {
    if (!projectId) {
      setError("Không thể kiểm tra chức năng vì dự án chưa được tải từ cơ sở dữ liệu.");
      return;
    }
    setLoadingCoverage(true);
    setBusy(true);
    setAiTaskLabel("Đang kiểm tra mức độ đầy đủ chức năng...");
    setError("");
    try {
      const result = await checkProjectRequirementCoverage(projectId);
      setCoverageAnalysis(result);
      setSelectedCoverageSuggestions({});
    } catch (reason) {
      setCoverageAnalysis(null);
      setError(`Không thể kiểm tra mức độ đầy đủ của chức năng: ${formatError(reason)}`);
    } finally {
      setLoadingCoverage(false);
      setAiTaskLabel("");
      setBusy(false);
    }
  };

  const selectedCoverageIndexes = Object.entries(selectedCoverageSuggestions)
    .filter(([, selected]) => selected)
    .map(([index]) => Number(index))
    .filter((index) => !addedCoverageSuggestions.includes(index));

  const addCoverageSuggestion = async (index: number) => {
    if (!projectId || !coverageAnalysis || busy || addedCoverageSuggestions.includes(index)) return;
    const suggestion = coverageAnalysis.suggestions[index];
    if (!suggestion) {
      setError("Gợi ý chức năng không còn hợp lệ. Hãy kiểm tra lại.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await createProjectRequirementsBatch(projectId, [{
        actor: suggestion.actor,
        action: suggestion.action,
        target_object: suggestion.target_object,
        purpose: suggestion.purpose,
        pre_conditions: suggestion.pre_conditions,
        business_rules: suggestion.business_rules,
      }]);
      setRequirements((previous) => [...previous, ...created]);
      setRequirementValues((previous) => ({
        ...previous,
        ...Object.fromEntries(created.map((item) => [item.id, parseRequirement(item.content)])),
      }));
      setAddedCoverageSuggestions((previous) => previous.includes(index) ? previous : [...previous, index]);
      setCoverageAddedCount((previous) => previous + created.length);
      setSelectedCoverageSuggestions((previous) => ({ ...previous, [index]: false }));
    } catch (reason) {
      setError(`Không thể thêm chức năng được chọn: ${formatError(reason)}`);
    } finally {
      setBusy(false);
    }
  };

  const addSelectedCoverageSuggestions = async () => {
    if (!projectId || !coverageAnalysis || busy) return;
    const indexes = selectedCoverageIndexes.filter(
      (index) => coverageAnalysis.suggestions[index] && !addedCoverageSuggestions.includes(index),
    );
    if (indexes.length === 0) {
      setError("Vui lòng chọn ít nhất một chức năng chưa được thêm.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const payloads = indexes.map((index) => {
        const suggestion = coverageAnalysis.suggestions[index];
        return {
          actor: suggestion.actor,
          action: suggestion.action,
          target_object: suggestion.target_object,
          purpose: suggestion.purpose,
          pre_conditions: suggestion.pre_conditions,
          business_rules: suggestion.business_rules,
        };
      });
      const created = await createProjectRequirementsBatch(projectId, payloads);
      setRequirements((previous) => [...previous, ...created]);
      setRequirementValues((previous) => ({
        ...previous,
        ...Object.fromEntries(created.map((item) => [item.id, parseRequirement(item.content)])),
      }));
      setAddedCoverageSuggestions((previous) => [
        ...previous,
        ...indexes.filter((index) => !previous.includes(index)),
      ]);
      setCoverageAddedCount((previous) => previous + created.length);
      setSelectedCoverageSuggestions((previous) => {
        const next = { ...previous };
        indexes.forEach((index) => { next[index] = false; });
        return next;
      });
    } catch (reason) {
      setError(`Không thể thêm các chức năng được chọn: ${formatError(reason)}`);
    } finally {
      setBusy(false);
    }
  };

  const generateStoryDrafts = useCallback(async (requirementId?: number) => {
    if (!projectId) return;
    setLoadingStoryDrafts(true);
    setAiTaskLabel(requirementId ? "Đang hoàn thiện User Story hiện tại..." : "Đang hoàn thiện tất cả User Story...");
    setError("");
    try {
      const cacheKey = `genai-uml:user-story-drafts:${projectId}`;
      const result = await previewProjectUserStories(projectId);
      if (requirementId !== undefined) {
        const currentDraft = result.results.find((story) => story.requirement_id === requirementId);
        if (!currentDraft) {
          throw new Error("Không tìm thấy bản nháp cho yêu cầu đang mở.");
        }
        setStoryDrafts((previous) => {
          const next = { ...previous, [requirementId]: currentDraft };
          try { window.localStorage.setItem(cacheKey, JSON.stringify(next)); } catch { /* Bộ nhớ trình duyệt có thể bị tắt. */ }
          return next;
        });
      } else {
        // Chỉ bổ sung các User Story chưa có bản nháp; không ghi đè nội dung đã sinh/chỉnh sửa.
        setStoryDrafts((previous) => {
          const next = { ...previous };
          result.results.forEach((story) => {
            if (!next[story.requirement_id]) next[story.requirement_id] = story;
          });
          try { window.localStorage.setItem(cacheKey, JSON.stringify(next)); } catch { /* Bộ nhớ trình duyệt có thể bị tắt. */ }
          return next;
        });
        setStoryDraftsEdited(false);
      }
    } catch (reason) {
      setError(`Không thể hoàn thiện User Story: ${formatError(reason)}`);
    } finally {
      setLoadingStoryDrafts(false);
      setAiTaskLabel("");
    }
  }, [projectId]);

  useEffect(() => {
    if (step !== 3 || !loaded || !projectId || !draftIdsKey || storyDraftsEdited) return;
    if (autoGeneratedStoryProjects.current.has(projectId)) return;
    const cacheKey = `genai-uml:user-story-drafts:${projectId}`;
    let cachedDrafts: Record<number, UserStoryDraft> = {};
    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) cachedDrafts = JSON.parse(cached) as Record<number, UserStoryDraft>;
    } catch { /* Cache không hợp lệ thì tạo lại bản nháp. */ }
    const availableDrafts = { ...cachedDrafts, ...storyDrafts };
    setStoryDrafts((previous) => ({ ...cachedDrafts, ...previous }));
    const hasAllCurrentDrafts = draftRequirements.every((item) => Boolean(availableDrafts[item.id]));
    if (hasAllCurrentDrafts) {
      autoGeneratedStoryProjects.current.add(projectId);
      return;
    }
    // Không bỏ qua việc sinh bản nháp chỉ vì đã có US được lưu; bổ sung khi còn UC thiếu.
    autoGeneratedStoryProjects.current.add(projectId);
    void generateStoryDrafts();
  }, [draftIdsKey, draftRequirements, generateStoryDrafts, loaded, projectId, step, storyDrafts, storyDraftsEdited]);

  const changeStoryDraft = (
    requirementId: number,
    field: Exclude<keyof UserStoryDraft, "requirement_id">,
    value: string,
  ) => {
    setStoryDrafts((previous) => {
      const next = {
        ...previous,
        [requirementId]: {
          ...previous[requirementId],
          requirement_id: requirementId,
          [field]: value,
        },
      };
      if (projectId) {
        try { window.localStorage.setItem(`genai-uml:user-story-drafts:${projectId}`, JSON.stringify(next)); } catch { /* Bộ nhớ trình duyệt có thể bị tắt. */ }
      }
      return next;
    });
    setStoryDraftsEdited(true);
  };

  const confirmAll = async () => {
    if (!projectId || !allStoryDraftsReady) return;
    setBusy(true);
    setError("");
    try {
      const approvedStories = draftRequirements.map((item) => storyDrafts[item.id]);
      const confirmedStories = await confirmProjectRequirementsBatch(
        projectId,
        draftRequirements.map((item) => item.id),
        approvedStories,
      );
      setRequirements((previous) =>
        previous.map((item) => {
          const story = confirmedStories.find((candidate) => candidate.requirement_id === item.id);
          return story ? { ...item, status: "confirmed", user_story: story } : item;
        }),
      );
      setStories((previous) => {
        const byId = new Map(previous.map((item) => [item.id, item]));
        confirmedStories.forEach((item) => byId.set(item.id, item));
        return [...byId.values()];
      });
      setState((previous) => ({
        ...previous,
        requirementLocked: true,
        userStoryId: confirmedStories[0]?.id ?? previous.userStoryId,
      }));
      onStepChange(4);
    } catch (reason) {
      setError(`Không thể xác nhận toàn bộ yêu cầu: ${formatError(reason)}`);
      try {
        await refreshProjectData();
      } catch (refreshError) {
        setError(
          `Không thể xác nhận toàn bộ yêu cầu: ${formatError(reason)}. ` +
          `Không thể tải lại dữ liệu: ${formatError(refreshError)}`,
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const generateFunctionalSpecification = useCallback(async (
    _story: UserStory,
    regenerate = false,
    skipRegenerationConfirmation = false,
  ): Promise<boolean> => {
    if (!projectId) return false;
    const requestKey = `${projectId}:functional:consolidated`;
    if (generationInFlight.current.has(requestKey)) return false;
    if (regenerate && !skipRegenerationConfirmation && !window.confirm(
      "AI sẽ phân tích lại toàn bộ US và thay thế danh sách FR tổng hợp. Các chỉnh sửa chưa lưu có thể bị mất. Bạn có muốn tiếp tục?",
    )) return false;
    generationInFlight.current.add(requestKey);
    setGeneratingStories((previous) => ({ ...previous, [_story.id]: true }));
    setBusy(true);
    setAiTaskLabel("Đang tổng hợp User Story thành các chức năng...");
    setAiTaskDetails("Đang khởi tạo tiến trình tổng hợp...");
    setError("");
    try {
      const created = await consolidateProjectFunctionalSpecifications(projectId, regenerate);
      setSpecifications((previous) => [
        ...previous.filter((item) => item.type !== "functional" || item.user_story_id !== null),
        ...created,
      ]);
      setState((previous) => ({
        ...previous,
        specs: [
          ...previous.specs.filter((item) => item.type !== "functional" || item.userStoryId !== undefined),
          ...created.map(toSpecDoc),
        ],
      }));
      await refreshSpecifications();
      setSpecDrafts((previous) => {
        const next = { ...previous };
        created.forEach((item) => { delete next[item.id]; });
        return next;
      });
      await refreshSrsDocument();
      return true;
    } catch (reason) {
      setError(`Không thể tổng hợp User Story thành FR: ${formatError(reason)}`);
      return false;
    } finally {
      generationInFlight.current.delete(requestKey);
      setGeneratingStories((previous) => ({ ...previous, [_story.id]: false }));
      setAiTaskLabel("");
      setAiTaskDetails("");
      setBusy(generationInFlight.current.size > 0);
    }
  }, [projectId, refreshSpecifications, refreshSrsDocument, setState]);

  const approveSavedSpecification = async (specification: SpecificationRecord) => {
    setBusy(true);
    setError("");
    try {
      const approval = await approveSpecification(specification.id);
      // Cập nhật trạng thái ngay từ phản hồi xác nhận của backend, không chờ
      // danh sách đặc tả được tải lại mới mở khóa Giai đoạn 2.
      setSpecifications((previous) =>
        previous.map((item) =>
          item.id === specification.id
            ? { ...item, approval_status: approval.approval_status }
            : item,
        ),
      );
      setState((previous) => ({
        ...previous,
        specs: previous.specs.map((item) =>
          item.id === specification.id
            ? { ...item, approved: approval.approval_status === "approved" }
            : item,
        ),
      }));
      // Không tải đè trạng thái vừa được backend xác nhận bằng một request
      // danh sách có thể đến chậm; lần tải lại dự án sau vẫn lấy trạng thái chuẩn từ API.
      await refreshSrsDocument();
    } catch (reason) {
      setError(`Không thể duyệt đặc tả: ${formatError(reason)}`);
    } finally {
      setBusy(false);
    }
  };

  const saveSpecification = async (
    specification: SpecificationRecord,
    content: FunctionalSpecification | NonFunctionalSpecification,
  ) => {
    setBusy(true);
    setError("");
    try {
      await updateSpecification(specification.id, content);
      await refreshSpecifications();
      setSpecDrafts((previous) => {
        const next = { ...previous };
        delete next[specification.id];
        return next;
      });
      await refreshSrsDocument();
    } catch (reason) {
      setError(`Không thể lưu thay đổi đặc tả: ${formatError(reason)}`);
    } finally {
      setBusy(false);
    }
  };

  const createNonFunctionalSpecification = useCallback(async (
    regenerate = false,
    skipRegenerationConfirmation = false,
  ): Promise<boolean> => {
    if (!projectId) return false;
    const requestKey = `${projectId}:non_functional`;
    if (generationInFlight.current.has(requestKey)) return false;
    if (regenerate && !skipRegenerationConfirmation && !window.confirm(
      "AI sẽ thay thế toàn bộ nội dung đặc tả hiện tại, kể cả các chỉnh sửa chưa lưu. Bạn có muốn tiếp tục?",
    )) return false;
    generationInFlight.current.add(requestKey);
    setGeneratingNonFunctional(true);
    setBusy(true);
    setAiTaskLabel("Đang sinh đặc tả phi chức năng...");
    setError("");
    try {
      const generated = await generateNonFunctionalSpecification(projectId, regenerate);
      await refreshSpecifications();
      setSpecDrafts((previous) => {
        const next = { ...previous };
        delete next[generated.id];
        return next;
      });
      await refreshSrsDocument();
      return true;
    } catch (reason) {
      setError(`Không thể sinh đặc tả phi chức năng: ${formatError(reason)}`);
      return false;
    } finally {
      generationInFlight.current.delete(requestKey);
      setGeneratingNonFunctional(false);
      setAiTaskLabel("");
      setBusy(generationInFlight.current.size > 0);
    }
  }, [projectId, refreshSpecifications, refreshSrsDocument]);

  // Không tự gọi AI khi chỉ mở Bước 4; việc sinh FR/NFR do người dùng chủ động thực hiện.


  const saveSrsMetadataDraft = async () => {
    if (!projectId) return;
    setBusy(true);
    setError("");
    try {
      await saveSrsMetadata(projectId, srsMetadata);
      setSrsMetadataSaved({ ...srsMetadata });
    } catch (reason) {
      setError(`Không thể lưu nội dung tài liệu: ${formatError(reason)}`);
    } finally {
      setBusy(false);
    }
  };

  const generateRemainingSrsFields = async () => {
    if (!projectId) return;
    setBusy(true);
    setAiTaskLabel("Đang hoàn thiện các trường SRS còn lại bằng AI...");
    setError("");
    try {
      const generated = await generateSrsMetadata(projectId);
      setSrsMetadata(generated);
      await saveSrsMetadata(projectId, generated);
      setSrsMetadataSaved(generated);
      await refreshSrsDocument();
      setSrsMetadata(generated);
    } catch (reason) {
      setError(`Không thể hoàn thiện các trường SRS bằng AI: ${formatError(reason)}`);
    } finally {
      setBusy(false);
      setAiTaskLabel("");
    }
  };

  const saveSrsSpecification = async (
    record: SpecificationRecord,
    content: FunctionalSpecification | NonFunctionalSpecification,
  ) => {
    setBusy(true);
    setError("");
    try {
      const saved = await updateSpecification(record.id, content);
      // Cập nhật đúng bản ghi vừa lưu; không tải lại toàn bộ SRS vì việc đó
      // có thể ghi đè các trường người dùng vẫn đang chỉnh sửa.
      setSpecifications((previous) => previous.map((item) => item.id === record.id ? saved : item));
      setState((previous) => ({
        ...previous,
        specs: previous.specs.map((item) => item.id === record.id
          ? { ...item, content: saved.content, approved: saved.approval_status === "approved" }
          : item),
      }));
      setSrsSpecDrafts((previous) => {
        const next = { ...previous };
        delete next[record.id];
        return next;
      });
    } catch (reason) {
      setError(`Không thể lưu đặc tả ${record.feature}: ${formatError(reason)}`);
    } finally {
      setBusy(false);
    }
  };

  const srsMetadataDirty =
    srsMetadataSaved === null ||
    META_KEYS.some((key) => srsMetadata[key] !== (srsMetadataSaved?.[key] ?? ""));

  const srsFunctionalForEditor = specifications
    .filter((item) => item.type === "functional")
    .map((item) => ({
      ...item,
      value: (srsSpecDrafts[item.id] as FunctionalSpecification | undefined) ??
        parseSpecification(item.content, emptyFunctionalSpecification()),
    }));

  const srsNonFunctionalForEditor = specifications
    .filter((item) => item.type === "non_functional")
    .map((item) => ({
      ...item,
      value: (srsSpecDrafts[item.id] as NonFunctionalSpecification | undefined) ??
        parseSpecification(item.content, emptyNonFunctionalSpecification()),
    }));

  const step1 = (
    <Step1NhapYeuCau
      newRequirement={newRequirement}
      requirementValues={requirementValues}
      requirements={requirements}
      busy={busy}
      loaded={loaded}
      error={error}
      coverageAnalysis={coverageAnalysis}
      loadingCoverage={loadingCoverage}
      addedCoverageSuggestions={addedCoverageSuggestions}
      coverageAddedCount={coverageAddedCount}
      selectedCoverageSuggestions={selectedCoverageSuggestions}
      selectedCoverageIndexes={selectedCoverageIndexes}
      onChangeNewField={changeNewField}
      onChangeNewList={changeNewList}
      onAddRequirement={addRequirement}
      onRemoveRequirement={removeRequirement}
      onCheckCoverage={checkRequirementCoverage}
      onToggleCoverageSuggestion={(index, selected) =>
        setSelectedCoverageSuggestions((previous) => ({ ...previous, [index]: selected }))
      }
      onAddSelectedCoverage={addSelectedCoverageSuggestions}
      requirementTitle={requirementTitle}
    />
  );

  const step2 = (
    <Step2PhanTichYeuCau
      projectId={projectId}
      requirements={requirements}
      requirementValues={requirementValues}
      coverageAnalysis={coverageAnalysis}
      loadingCoverage={loadingCoverage}
      addedCoverageSuggestions={addedCoverageSuggestions}
      coverageAddedCount={coverageAddedCount}
      selectedCoverageSuggestions={selectedCoverageSuggestions}
      onCheckCoverage={checkRequirementCoverage}
      onToggleCoverageSuggestion={(index, selected) => {
        if (selected) {
          void addCoverageSuggestion(index);
        } else {
          setSelectedCoverageSuggestions((previous) => ({ ...previous, [index]: false }));
        }
      }}
      busy={busy}
      loaded={loaded}
      error={error}
      onStepChange={onStepChange}
      requirementTitle={requirementTitle}
      wrapClass={wrapClass}
    />
  );

  const step3 = (
    <Step3UserStory
      projectId={projectId}
      draftRequirements={draftRequirements}
      confirmedRequirementsCount={requirements.filter((item) => item.status === "confirmed").length}
      savedStories={stories}
      requirementValues={requirementValues}
      storyDrafts={storyDrafts}
      loadingStoryDrafts={loadingStoryDrafts}
      busy={busy}
      loaded={loaded}
      error={error}
      allStoryDraftsReady={allStoryDraftsReady}
      allRequirementsConfirmed={allRequirementsConfirmed}
      changeStoryDraft={changeStoryDraft}
      generateStoryDrafts={generateStoryDrafts}
      onStorySaved={(savedStory) => {
        setStories((previous) => {
          const existing = previous.some((story) => story.id === savedStory.id);
          return existing
            ? previous.map((story) => story.id === savedStory.id ? savedStory : story)
            : [...previous, savedStory];
        });
        setRequirements((previous) =>
          previous.map((item) =>
            item.id === savedStory.requirement_id
              ? { ...item, user_story: savedStory }
              : item,
          ),
        );
      }}
      confirmAll={confirmAll}
      onStepChange={onStepChange}
      requirementTitle={requirementTitle}
      wrapClass={wrapClass}
      inputClass={inputClass}
    />
  );

  const step4 = (
    <Step4DacTa
      projectId={projectId}
      stories={stories}
      specifications={specifications}
      expandedFunctionalSpecifications={expandedFunctionalSpecifications}
      setExpandedFunctionalSpecifications={setExpandedFunctionalSpecifications}
      functionalSpecificationTabs={functionalSpecificationTabs}
      setFunctionalSpecificationTabs={setFunctionalSpecificationTabs}
      specDrafts={specDrafts}
      setSpecDrafts={setSpecDrafts}
      generatingStories={generatingStories}
      generatingNonFunctional={generatingNonFunctional}
      busy={busy}
      error={error}
      generateFunctionalSpecification={generateFunctionalSpecification}
      saveSpecification={saveSpecification}
      approveSpecification={approveSavedSpecification}
      createNonFunctionalSpecification={createNonFunctionalSpecification}
      onStepChange={onStepChange}
      wrapClass={wrapClass}
      inputClass={inputClass}
    />
  );

  // Cho Bước 5 hiển thị khung trước; hoãn dựng Phụ lục B nặng sang sau vài frame.
  useEffect(() => {
    if (step !== 5) {
      setAppendixReady(false);
      return;
    }
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setAppendixReady(true));
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [step]);

  // Tải trực tiếp mô hình UML đã lưu từ backend khi mở tài liệu SRS.
  // Không phụ thuộc vào state trong bộ nhớ, vì state có thể rỗng sau khi mở lại dự án.
  useEffect(() => {
    if (!projectId || step !== 5) return;
    let cancelled = false;
    void getProjectUmlState(projectId).then((saved) => {
      if (cancelled) return;
      const actors = Array.isArray(saved?.actors) ? saved.actors : [];
      const useCases = Array.isArray(saved?.use_cases) ? saved.use_cases : [];
      const relations = Array.isArray(saved?.relations) ? saved.relations : [];
      const diagrams = Array.isArray(saved?.diagrams) ? saved.diagrams : [];
      const classes = Array.isArray(saved?.classes) ? saved.classes : [];
      const classRelations = Array.isArray(saved?.class_relations) ? saved.class_relations : [];
      const actorById = new Map(actors.map((item) => [item.id, item.name]));
      const useCaseById = new Map(useCases.map((item) => [item.id, item.name]));
      const classById = new Map(classes.map((item) => [item.id, item.name]));
      const umlRelations = [
        ...relations.flatMap((relation) => {
          const from = actorById.get(relation.actor_id);
          const to = useCaseById.get(relation.use_case_id);
          return from && to ? [{ id: relation.id, from, to, type: relation.relation_type }] : [];
        }),
        ...classRelations.flatMap((relation) => {
          const from = classById.get(relation.class_a_id);
          const to = classById.get(relation.class_b_id);
          return from && to ? [{ id: relation.id, from, to, type: relation.relation_type }] : [];
        }),
      ];
      const useCaseDiagram = diagrams.filter((item) => item.type === "use_case" && item.use_case_id === null).at(-1);
      const classDiagram = diagrams.filter((item) => item.type === "class" && item.use_case_id === null).at(-1);
      const latestUseCaseDiagrams = new Map<number, (typeof diagrams)[number]>();
      diagrams.forEach((item) => {
        if (item.type !== "use_case" || item.use_case_id === null) return;
        const previous = latestUseCaseDiagrams.get(item.use_case_id);
        if (!previous || previous.id < item.id) latestUseCaseDiagrams.set(item.use_case_id, item);
      });
      const latestActivityDiagrams = new Map<number, (typeof diagrams)[number]>();
      diagrams.forEach((item) => {
        if (item.type !== "activity" || item.use_case_id === null) return;
        const previous = latestActivityDiagrams.get(item.use_case_id);
        if (!previous || previous.id < item.id) latestActivityDiagrams.set(item.use_case_id, item);
      });
      const latestInteractions = new Map<string, (typeof diagrams)[number]>();
      diagrams.forEach((item) => {
        if (item.use_case_id === null || (item.type !== "sequence" && item.type !== "collaboration")) return;
        const key = `${item.use_case_id}:${item.type}`;
        const previous = latestInteractions.get(key);
        if (!previous || previous.id < item.id) latestInteractions.set(key, item);
      });
      setState((previous) => ({
        ...previous,
        actors: actors.map((item) => ({
          id: item.id, name: item.name, description: item.description ?? "",
          role: item.role ?? "", mainBusinesses: item.main_businesses ?? "",
        })),
        usecases: useCases.map((item) => ({
          id: item.id, name: item.name, description: item.description ?? "", specificationId: item.specification_id,
        })),
        // Lấy đầy đủ kịch bản gốc từ backend; các trường văn bản được lưu
        // dưới dạng chuỗi nhiều dòng, còn các luồng là danh sách bước.
        scenarios: Object.fromEntries(useCases.map((item) => {
          const asLines = (value: string | null | undefined) =>
            typeof value === "string" ? value.split("\\n").filter((line) => line.trim().length > 0) : [];
          return [item.id, {
            actor: asLines(item.actor),
            description: asLines(item.description),
            preconditions: asLines(item.preconditions),
            mainFlow: Array.isArray(item.main_flow) ? item.main_flow : [],
            altFlows: Array.isArray(item.alt_flow) ? item.alt_flow : [],
            exceptions: Array.isArray(item.exception_flow) ? item.exception_flow : [],
            minimalGuarantees: asLines(item.minimal_guarantees),
            postconditions: asLines(item.postconditions),
          }];
        })),
        useCaseDiagramUrl: useCaseDiagram?.image_url ?? null,
        useCaseDiagramCode: useCaseDiagram?.source_code ?? null,
        useCaseDiagrams: [...latestUseCaseDiagrams.values()].map((item) => ({
          usecaseId: item.use_case_id as number,
          imageUrl: item.image_url,
        })),
        activityDiagrams: [...latestActivityDiagrams.values()].map((item) => ({
          usecaseId: item.use_case_id as number,
          imageUrl: item.image_url,
        })),
        interactions: [...latestInteractions.values()].map((item) => ({
          usecaseId: item.use_case_id as number,
          type: item.type as "sequence" | "collaboration",
          imageUrl: item.image_url,
          sourceCode: item.source_code,
        })),
        umlClasses: classes.map((item) => ({
          id: item.id, name: item.name,
          attributes: Array.isArray(item.attributes) ? item.attributes : [],
          methods: Array.isArray(item.methods) ? item.methods : [],
        })),
        classDiagramUrl: classDiagram?.image_url ?? null,
        classDiagramCode: classDiagram?.source_code ?? null,
        relations: umlRelations,
      }));
    }).catch((reason) => {
      console.error("Không thể tải mô hình UML cho Phụ lục B:", reason);
    });
    return () => { cancelled = true; };
  }, [projectId, step, setState]);

  // Chỉ dựng Phụ lục B khi vào Bước 5; tránh tạo hàng loạt bảng/ảnh/kịch bản ở Bước 4.
  const appendixBContent = step === 5 && appendixReady ? (
    <div className="space-y-6 text-sm leading-6">
      <section>
        <h3 className="mb-3 mt-4 text-[15px] font-bold">1. Mô hình hóa chức năng</h3>
        <h4 className="mb-2 font-bold">1.1 Danh sách tác nhân</h4>
        {state.actors.length ? (
          <table className="mb-5 w-full table-fixed border-collapse border border-slate-400 text-left text-xs">
            <thead><tr><th className="border border-slate-300 bg-slate-100 p-2">Tên tác nhân</th><th className="border border-slate-300 bg-slate-100 p-2">Vai trò / mô tả</th></tr></thead>
            <tbody>{state.actors.map((actor) => <tr key={actor.id}><td className="border border-slate-300 p-2">{actor.name}</td><td className="border border-slate-300 p-2">{[actor.role, actor.description, actor.mainBusinesses].filter(Boolean).join(" — ") || "—"}</td></tr>)}</tbody>
          </table>
        ) : <p className="mb-5">Chưa có tác nhân được lưu.</p>}
        <h4 className="mb-2 font-bold">1.2 Biểu đồ Use Case tổng quan</h4>
        {state.useCaseDiagramUrl ? <img src={state.useCaseDiagramUrl} alt="Biểu đồ Use Case tổng quan" className="mx-auto my-3 max-w-full" /> : <p>Chưa có ảnh biểu đồ Use Case tổng quan được lưu.</p>}
        {state.usecases.length > 0 && (
          <table className="mt-3 w-full table-fixed border-collapse border border-slate-400 text-left text-xs">
            <thead><tr><th className="border border-slate-300 bg-slate-100 p-2">Use Case</th><th className="border border-slate-300 bg-slate-100 p-2">Tác nhân liên kết</th></tr></thead>
            <tbody>{state.usecases.map((useCase) => <tr key={useCase.id}><td className="border border-slate-300 p-2">{useCase.name}</td><td className="border border-slate-300 p-2">{state.relations.filter((relation) => relation.to === useCase.name && state.actors.some((actor) => actor.name === relation.from)).map((relation) => relation.from).join(", ") || "—"}</td></tr>)}</tbody>
          </table>
        )}
        {state.usecases.map((useCase, index) => {
          const scenario = state.scenarios[useCase.id];
          const activityDiagram = (state.activityDiagrams ?? []).find((diagram) => diagram.usecaseId === useCase.id);
          const useCaseDiagram = (state.useCaseDiagrams ?? []).find((diagram) => diagram.usecaseId === useCase.id);
          return <div key={useCase.id} className="mt-6 break-inside-avoid">
            <h4 className="mb-2 font-bold">{"1.2." + (index + 1) + " " + useCase.name}</h4>
            <p className="font-semibold">Sơ đồ Use Case</p>
            {useCaseDiagram?.imageUrl ? <img src={useCaseDiagram.imageUrl} alt={"Sơ đồ Use Case — " + useCase.name} className="mx-auto my-2 max-w-full" /> : state.useCaseDiagramUrl ? <img src={state.useCaseDiagramUrl} alt={"Biểu đồ Use Case tổng quan"} className="mx-auto my-2 max-w-full" /> : <p>Chưa có ảnh sơ đồ Use Case được lưu.</p>}
            <p className="mt-3 font-semibold">Biểu đồ hoạt động</p>
            {activityDiagram?.imageUrl ? <img src={activityDiagram.imageUrl} alt={"Biểu đồ hoạt động — " + useCase.name} className="mx-auto my-2 max-w-full" /> : <p>Chưa có ảnh biểu đồ hoạt động được lưu cho Use Case này.</p>}
            <p className="mt-3 font-semibold">Kịch bản</p>
            {!scenario ? <p>Chưa có kịch bản được lưu.</p> : (
              <table className="mb-3 w-full table-fixed border-collapse border border-slate-400 text-left text-xs leading-5">
                <thead>
                  <tr>
                    <th className="w-[28%] border border-slate-300 bg-slate-100 p-2">Thành phần kịch bản</th>
                    <th className="border border-slate-300 bg-slate-100 p-2">Nội dung</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["Tác nhân", scenario.actor?.join("\n") || "—"],
                    ["Mô tả", scenario.description?.join("\n") || useCase.description || "—"],
                    ["Điều kiện trước", scenario.preconditions?.join("\n") || "—"],
                    ["Luồng chính", scenario.mainFlow],
                    ["Luồng thay thế", scenario.altFlows],
                    ["Ngoại lệ", scenario.exceptions],
                    ["Cam kết tối thiểu", scenario.minimalGuarantees?.join("\n") || "—"],
                    ["Điều kiện sau", scenario.postconditions?.join("\n") || "—"],
                  ] as [string, string | string[]][]).map(([label, content]) => (
                    <tr key={label} className="break-inside-avoid align-top">
                      <th className="border border-slate-300 bg-slate-50 p-2 font-semibold">{label}</th>
                      <td className="border border-slate-300 p-2">
                        {Array.isArray(content) ? (
                          content.length ? (
                            <ol className="list-decimal space-y-1 pl-5">
                              {content.map((line, lineIndex) => <li key={lineIndex} className="whitespace-pre-wrap">{line}</li>)}
                            </ol>
                          ) : "—"
                        ) : <span className="whitespace-pre-wrap">{content}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>;
        })}
        {!state.usecases.length && <p>Chưa có Use Case được lưu.</p>}
      </section>

      <section>
        <h3 className="mb-3 mt-4 text-[15px] font-bold">2. Mô hình hóa cấu trúc</h3>
        <h4 className="mb-2 font-bold">2.1 Biểu đồ lớp</h4>
        {state.classDiagramUrl ? <img src={state.classDiagramUrl} alt="Biểu đồ lớp" className="mx-auto my-3 max-w-full" /> : <p>Chưa có ảnh biểu đồ lớp được lưu.</p>}
        <h4 className="mb-2 mt-5 font-bold">2.2 Mô tả các lớp và mối quan hệ</h4>
        {state.umlClasses.length ? (
          <div className="space-y-5">
            {state.umlClasses.map((item) => {
              const classRelations = state.relations.filter(
                (relation) => relation.from === item.name || relation.to === item.name,
              );
              const relatedClassNames = [...new Set(classRelations.map(
                (relation) => relation.from === item.name ? relation.to : relation.from,
              ))];
              return (
                <article key={item.id} className="break-inside-avoid">
                  <h5 className="mb-2 font-bold">Lớp {item.name}</h5>
                  <p className="mb-3">
                    Lớp {item.name} đại diện cho một thực thể trong mô hình cấu trúc của hệ thống.
                    Các thuộc tính mô tả dữ liệu của thực thể, các phương thức thể hiện những thao tác
                    được định nghĩa cho lớp.
                    {classRelations.length > 0
                      ? ` Lớp có mối quan hệ với ${relatedClassNames.join(", ")}.`
                      : " Hiện chưa có mối quan hệ nào được lưu cho lớp này."}
                  </p>
                  <table className="w-full table-fixed border-collapse border border-slate-400 text-left text-xs leading-5">
                    <tbody>
                      <tr>
                        <th className="w-[22%] border border-slate-300 bg-slate-100 p-2">Thuộc tính</th>
                        <td className="border border-slate-300 p-2">
                          {item.attributes.length ? (
                            <ul className="list-disc space-y-1 pl-5">
                              {item.attributes.map((attribute, index) => <li key={index} className="whitespace-pre-wrap">{attribute}</li>)}
                            </ul>
                          ) : "—"}
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-slate-300 bg-slate-100 p-2">Phương thức</th>
                        <td className="border border-slate-300 p-2">
                          {item.methods.length ? (
                            <ul className="list-disc space-y-1 pl-5">
                              {item.methods.map((method, index) => <li key={index} className="whitespace-pre-wrap">{method}</li>)}
                            </ul>
                          ) : "—"}
                        </td>
                      </tr>
                      <tr>
                        <th className="border border-slate-300 bg-slate-100 p-2">Mối quan hệ</th>
                        <td className="border border-slate-300 p-2">
                          {classRelations.length ? (
                            <ul className="list-disc space-y-1 pl-5">
                              {classRelations.map((relation) => (
                                <li key={relation.id}>
                                  {relation.from === item.name ? relation.to : relation.from} — {relation.type}
                                </li>
                              ))}
                            </ul>
                          ) : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </article>
              );
            })}
          </div>
        ) : <p>Chưa có lớp trong Domain Model.</p>}
        {state.relations.length > 0 && <p className="mt-3 text-xs text-slate-600">Các mối quan hệ được mô tả tương ứng trong từng lớp ở trên.</p>}
      </section>

      <section>
        <h3 className="mb-3 mt-4 text-[15px] font-bold">3. Mô hình hóa hành vi</h3>
        <h4 className="mb-2 font-bold">3.1 Biểu đồ tuần tự cho từng Use Case</h4>
        {state.usecases.map((useCase) => {
          const diagram = (state.interactions ?? []).find((item) => item.usecaseId === useCase.id && item.type === "sequence");
          return <div key={useCase.id} className="mb-5 break-inside-avoid">
            <p className="font-semibold">{useCase.name}</p>
            {diagram?.imageUrl ? <img src={diagram.imageUrl} alt={"Biểu đồ tuần tự — " + useCase.name} className="mx-auto my-2 max-w-full" /> : <p>Chưa có ảnh biểu đồ tuần tự được lưu cho Use Case này.</p>}
          </div>;
        })}
        {!state.usecases.length && <p>Chưa có Use Case được lưu.</p>}
      </section>
    </div>
  ) : null;

  const step5 = (
    <Step5ChotTaiLieu
      projectName={projectName}
      srsMetadataDirty={srsMetadataDirty}
      srsMetadata={srsMetadata}
      srsMarkdown={srsMarkdown}
      specifications={specifications}
      srsFunctionalForEditor={srsFunctionalForEditor}
      srsNonFunctionalForEditor={srsNonFunctionalForEditor}
      srsSpecDrafts={srsSpecDrafts}
      busy={busy}
      onStepChange={onStepChange}
      saveSrsMetadataDraft={saveSrsMetadataDraft}
      onGenerateRemainingFields={generateRemainingSrsFields}
      saveSrsSpecification={saveSrsSpecification}
      setSrsMetadata={setSrsMetadata}
      setSrsSpecDrafts={setSrsSpecDrafts}
      appendixBContent={appendixBContent}
      appendixUseCaseNames={state.usecases.map((useCase) => useCase.name)}
    />
  );

  const missingProjectMessage = projectId ? "" : "Dự án chưa có ID hợp lệ trong cơ sở dữ liệu.";
  const alertMessage = error || missingProjectMessage;

  return (
    <div className={`relative w-full ${step === 4 || step === 5 ? "flex h-full min-h-0 flex-1 flex-col" : ""}`}>
      {aiTaskLabel && <ProgressOverlay label={aiTaskLabel} details={aiTaskDetails} />}
      <div className={`relative z-10 w-full max-w-none px-4 sm:px-6 lg:px-8 ${step === 4 || step === 5 ? "flex h-full min-h-0 flex-1 flex-col space-y-0 pt-3 pb-2" : "space-y-6 py-6"}`}>
        {!loaded && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Đang tải dữ liệu từ cơ sở dữ liệu...
          </p>
        )}
        {alertMessage && (
          <div
            role="alert"
            className="break-words rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 [overflow-wrap:anywhere]"
          >
            {alertMessage}
          </div>
        )}
        {loaded && step === 1 && step1}
        {loaded && step === 2 && step2}
        {loaded && step === 3 && step3}
        {loaded && step === 4 && step4}
        {loaded && step === 5 && step5}
      </div>
    </div>
  );
}