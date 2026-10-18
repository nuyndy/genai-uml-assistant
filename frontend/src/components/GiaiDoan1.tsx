import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeProjectRequirementsBatch,
  checkProjectRequirementCoverage,
  confirmProjectRequirementsBatch,
  createRequirement,
  createProjectRequirementsBatch,
  deleteRequirement,
  generateNonFunctionalSpecification,
  generateSpecification,
  getSpecificationDocument,
  listProjectRequirements,
  listProjectSpecifications,
  listProjectUserStories,
  previewProjectUserStories,
  saveSrsMetadata,
  updateSpecification,
  exportSpecificationDocument,
  type FunctionalSpecification,
  type NonFunctionalSpecification,
  type RequirementAnalysis,
  type RequirementCoverageAnalysis,
  type RequirementCoverageSuggestion,
  type RequirementPayload,
  type RequirementRecord,
  type SpecificationRecord,
  type SrsMetadata,
  type UserStory,
  type UserStoryDraft,
} from "../services/requirementService";
import type { RawRequirement, SpecDoc, WorkflowState } from "../types/workflow";
import { STAGES } from "../stages";
import Step1NhapYeuCau from "./features/giai-doan-1/steps/Step1NhapYeuCau";
import Step5ChotTaiLieu from "./features/giai-doan-1/steps/Step5ChotTaiLieu";
import ProgressOverlay from "./common/ProgressOverlay";
import {
  emptyFunctionalSpecification,
  emptyNonFunctionalSpecification,
  FunctionalSpecificationEditor,
  NonFunctionalSpecificationEditor,
  type FunctionalSpecificationTab,
} from "./SpecificationEditor";
import type { RequirementInput } from "./step1/types";
import {
  Card,
  EmptyState,
  GhostButton,
  PrimaryButton,
  RemoveButton,
  SoftButton,
  StatusBadge,
  StepHeading,
  inputClass,
  wrapClass,
} from "./common/ui/primitives";

interface Props {
  projectId?: number;
  state: WorkflowState;
  setState: (updater: (prev: WorkflowState) => WorkflowState) => void;
  step: number;
  onStepChange: (step: number) => void;
}

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
    approved: true,
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
  state,
  setState,
  step,
  onStepChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState("");
  const [aiTaskLabel, setAiTaskLabel] = useState("");
  const [loaded, setLoaded] = useState(!projectId);
  const [requirements, setRequirements] = useState<RequirementRecord[]>([]);
  const [requirementValues, setRequirementValues] = useState<Record<number, RawRequirement>>({});
  const [analyses, setAnalyses] = useState<Record<number, RequirementAnalysis>>({});
  const [coverageAnalysis, setCoverageAnalysis] = useState<RequirementCoverageAnalysis | null>(null);
  const [selectedCoverageSuggestions, setSelectedCoverageSuggestions] =
    useState<Record<number, boolean>>({});
  const [addedCoverageSuggestions, setAddedCoverageSuggestions] = useState<number[]>([]);
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [newRequirement, setNewRequirement] = useState(state.rawRequirement);
  const [stories, setStories] = useState<UserStory[]>([]);
  const [storyDrafts, setStoryDrafts] = useState<Record<number, UserStoryDraft>>({});
  const [loadingStoryDrafts, setLoadingStoryDrafts] = useState(false);
  const [specifications, setSpecifications] = useState<SpecificationRecord[]>(
    projectId
      ? []
      : state.specs.map((item) => ({
          id: item.id,
          user_story_id: item.userStoryId ?? 0,
          feature: item.feature,
          type: item.type,
          content: item.content,
          version: item.version ?? 1,
        })),
  );
  const [specDrafts, setSpecDrafts] = useState<
    Record<number, FunctionalSpecification | NonFunctionalSpecification>
  >({});
  const [expandedFunctionalSpecifications, setExpandedFunctionalSpecifications] = useState<number[]>([]);
  const [functionalSpecificationTabs, setFunctionalSpecificationTabs] =
    useState<Record<number, FunctionalSpecificationTab>>({});
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
  const batchAnalysisKey = useRef("");
  const autoGenerationAttempts = useRef(new Set<string>());
  const generationInFlight = useRef(new Set<string>());
  const definition = STAGES[1].steps[step - 1];
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
        setRequirements(requirementRecords);
        setRequirementValues(parsed);
        setStories(storyRecords);
        syncSpecifications(specificationRecords);
        const latest = requirementRecords.at(-1);
        setNewRequirement(emptyRequirement());
        if (latest) {
          setState((previous) => ({
            ...previous,
            requirementId: latest.id,
            userStoryId: latest.user_story?.id ?? null,
            rawRequirement: parsed[latest.id] ?? emptyRequirement(),
            requirementLocked: latest.status === "confirmed",
          }));
        } else {
          setNewRequirement(emptyRequirement());
          setState((previous) => ({
            ...previous,
            requirementId: null,
            userStoryId: null,
            rawRequirement: emptyRequirement(),
            requirementLocked: false,
          }));
        }
        if (storyRecords.length > 0) {
          setState((previous) => ({
            ...previous,
            userStoryId: storyRecords[0].id,
          }));
        }
      } catch (reason) {
        if (!cancelled) setError(`Không thể tải dữ liệu giai đoạn 1: ${formatError(reason)}`);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Load project records once per project; step selection must not restart this request.
  }, [projectId, syncSpecifications, setState]);

  const runBatchAnalysis = useCallback(async () => {
    if (!projectId || draftRequirements.length === 0) {
      setAnalyses({});
      return;
    }
    setLoadingAnalysis(true);
    setAiTaskLabel("Đang phân tích yêu cầu...");
    setError("");
    try {
      const result = await analyzeProjectRequirementsBatch(projectId);
      setAnalyses(Object.fromEntries(result.results.map((item) => [item.requirement_id, item])));
    } catch (reason) {
      setError(`Không thể phân tích các yêu cầu: ${formatError(reason)}`);
    } finally {
      setLoadingAnalysis(false);
      setAiTaskLabel("");
    }
  }, [draftRequirements.length, projectId]);

  useEffect(() => {
    if (step !== 2) {
      batchAnalysisKey.current = "";
      return;
    }
    if (!loaded || !projectId || !draftIdsKey) return;
    const key = `${projectId}:${draftIdsKey}`;
    if (batchAnalysisKey.current === key) return;
    batchAnalysisKey.current = key;
    void runBatchAnalysis();
  }, [draftIdsKey, loaded, projectId, runBatchAnalysis, step]);

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

  useEffect(() => {
    if (step !== 5 || !projectId) return;
    void Promise.all([refreshSpecifications(), refreshSrsDocument()]).catch((reason: unknown) => {
      setError(`Không thể tải tài liệu đặc tả: ${formatError(reason)}`);
    });
  }, [projectId, refreshSrsDocument, refreshSpecifications, step]);

  const changeNewField = (field: keyof RequirementInput, value: string) => {
    setNewRequirement((previous) => ({ ...previous, [field]: value }));
  };

  const changeNewList = (field: "preConditions" | "businessRules", value: string[]) => {
    setNewRequirement((previous) => ({ ...previous, [field]: value }));
  };

  const addRequirement = async () => {
    if (!newRequirement.actor.trim() || !newRequirement.action.trim() ||
        !newRequirement.targetObject.trim() || !newRequirement.purpose.trim()) {
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
      setCoverageAnalysis(null);
      setSelectedCoverageSuggestions({});
      setAddedCoverageSuggestions([]);
      setRequirementValues((previous) => ({ ...previous, [created.id]: newRequirement }));
      setAnalyses((previous) => {
        const next = { ...previous };
        delete next[created.id];
        return next;
      });
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
      setCoverageAnalysis(null);
      setSelectedCoverageSuggestions({});
      setAddedCoverageSuggestions([]);
      setRequirementValues((previous) => {
        const next = { ...previous };
        delete next[requirementId];
        return next;
      });
      setAnalyses((previous) => {
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
      setAddedCoverageSuggestions([]);
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

  const addSelectedCoverageSuggestions = async () => {
    if (!projectId || !coverageAnalysis || selectedCoverageIndexes.length === 0) return;
    const selectedSuggestions: RequirementCoverageSuggestion[] = selectedCoverageIndexes
      .map((index) => coverageAnalysis.suggestions[index])
      .filter((suggestion): suggestion is RequirementCoverageSuggestion => suggestion !== undefined);
    if (selectedSuggestions.length !== selectedCoverageIndexes.length) {
      setError("Danh sách chức năng đề xuất không còn hợp lệ. Hãy kiểm tra lại.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await createProjectRequirementsBatch(
        projectId,
        selectedSuggestions.map(({
          actor,
          action,
          target_object,
          purpose,
          pre_conditions,
          business_rules,
        }) => ({
          actor,
          action,
          target_object,
          purpose,
          pre_conditions,
          business_rules,
        })),
      );
      setRequirements((previous) => [...previous, ...created]);
      setRequirementValues((previous) => ({
        ...previous,
        ...Object.fromEntries(created.map((item) => [item.id, parseRequirement(item.content)])),
      }));
      setAddedCoverageSuggestions((previous) => [...previous, ...selectedCoverageIndexes]);
      setSelectedCoverageSuggestions((previous) => {
        const next = { ...previous };
        selectedCoverageIndexes.forEach((index) => { next[index] = false; });
        return next;
      });
    } catch (reason) {
      setError(`Không thể lưu các chức năng đã chọn: ${formatError(reason)}`);
    } finally {
      setBusy(false);
    }
  };

  const generateStoryDrafts = useCallback(async () => {
    if (!projectId) return;
    setLoadingStoryDrafts(true);
    setAiTaskLabel("Đang tạo bản nháp User Story...");
    setError("");
    try {
      const result = await previewProjectUserStories(projectId);
      setStoryDrafts(
        Object.fromEntries(result.results.map((story) => [story.requirement_id, story])),
      );
    } catch (reason) {
      setError(`Không thể tạo bản nháp user story: ${formatError(reason)}`);
    } finally {
      setLoadingStoryDrafts(false);
      setAiTaskLabel("");
    }
  }, [projectId]);

  const storyPreviewKey = useRef("");
  useEffect(() => {
    if (step !== 3) {
      storyPreviewKey.current = "";
      return;
    }
    if (!loaded || !projectId) return;
    const key = `${projectId}:${draftIdsKey}`;
    if (storyPreviewKey.current === key) return;
    storyPreviewKey.current = key;
    void generateStoryDrafts();
  }, [draftIdsKey, generateStoryDrafts, loaded, projectId, step]);

  const changeStoryDraft = (
    requirementId: number,
    field: Exclude<keyof UserStoryDraft, "requirement_id">,
    value: string,
  ) => {
    setStoryDrafts((previous) => ({
      ...previous,
      [requirementId]: {
        ...previous[requirementId],
        requirement_id: requirementId,
        [field]: value,
      },
    }));
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
    story: UserStory,
    regenerate = false,
  ) => {
    if (!projectId) return;
    const requestKey = `${projectId}:functional:${story.id}`;
    if (generationInFlight.current.has(requestKey)) return;
    if (regenerate && !window.confirm(
      "AI sẽ thay thế toàn bộ nội dung đặc tả hiện tại, kể cả các chỉnh sửa chưa lưu. Bạn có muốn tiếp tục?",
    )) return;
    generationInFlight.current.add(requestKey);
    setGeneratingStories((previous) => ({ ...previous, [story.id]: true }));
    setBusy(true);
    setAiTaskLabel("Đang sinh đặc tả chức năng...");
    setError("");
    try {
      const created = await generateSpecification(story.id, "functional", regenerate);
      setSpecifications((previous) => [
        ...previous.filter((item) => item.id !== created.id),
        created,
      ]);
      setState((previous) => ({
        ...previous,
        specs: [
          ...previous.specs.filter((item) => item.id !== created.id),
          toSpecDoc(created),
        ],
      }));
      await refreshSpecifications();
      setSpecDrafts((previous) => {
        const next = { ...previous };
        delete next[created.id];
        return next;
      });
      await refreshSrsDocument();
    } catch (reason) {
      setError(`Không thể sinh đặc tả chức năng: ${formatError(reason)}`);
    } finally {
      generationInFlight.current.delete(requestKey);
      setGeneratingStories((previous) => ({ ...previous, [story.id]: false }));
      setAiTaskLabel("");
      setBusy(generationInFlight.current.size > 0);
    }
  }, [projectId, refreshSpecifications, refreshSrsDocument, setState]);

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

  const createNonFunctionalSpecification = useCallback(async (regenerate = false) => {
    if (!projectId) return;
    const requestKey = `${projectId}:non_functional`;
    if (generationInFlight.current.has(requestKey)) return;
    if (regenerate && !window.confirm(
      "AI sẽ thay thế toàn bộ nội dung đặc tả hiện tại, kể cả các chỉnh sửa chưa lưu. Bạn có muốn tiếp tục?",
    )) return;
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
    } catch (reason) {
      setError(`Không thể sinh đặc tả phi chức năng: ${formatError(reason)}`);
    } finally {
      generationInFlight.current.delete(requestKey);
      setGeneratingNonFunctional(false);
      setAiTaskLabel("");
      setBusy(generationInFlight.current.size > 0);
    }
  }, [projectId, refreshSpecifications, refreshSrsDocument]);

  useEffect(() => {
    if (step !== 4 || !loaded || !projectId || stories.length === 0) return;

    const pendingStories = stories.filter((story) => {
      const key = `${projectId}:functional:${story.id}`;
      const exists = specifications.some(
        (item) => item.user_story_id === story.id && item.type === "functional",
      );
      if (exists || autoGenerationAttempts.current.has(key)) return false;
      autoGenerationAttempts.current.add(key);
      return true;
    });
    const hasNonFunctional = specifications.some((item) => item.type === "non_functional");
    const nonFunctionalKey = `${projectId}:non_functional`;
    const shouldGenerateNonFunctional =
      !hasNonFunctional && !autoGenerationAttempts.current.has(nonFunctionalKey);
    if (shouldGenerateNonFunctional) {
      autoGenerationAttempts.current.add(nonFunctionalKey);
    }
    if (pendingStories.length === 0 && !shouldGenerateNonFunctional) return;

    void (async () => {
      for (const story of pendingStories) {
        await generateFunctionalSpecification(story);
      }
      if (shouldGenerateNonFunctional) {
        await createNonFunctionalSpecification();
      }
    })();
  }, [
    createNonFunctionalSpecification,
    generateFunctionalSpecification,
    loaded,
    projectId,
    specifications,
    step,
    stories,
  ]);

  const exportSrs = async () => {
    if (!projectId) return;
    setBusy(true);
    setError("");
    try {
      const { blob, filename } = await exportSpecificationDocument(projectId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(`Không thể xuất tài liệu: ${formatError(reason)}`);
    } finally {
      setBusy(false);
    }
  };

  const saveSrsMetadataDraft = async () => {
    if (!projectId) return;
    setBusy(true);
    setError("");
    try {
      await saveSrsMetadata(projectId, srsMetadata);
      setSrsMetadataSaved(srsMetadata);
      await refreshSrsDocument();
    } catch (reason) {
      setError(`Không thể lưu nội dung tài liệu: ${formatError(reason)}`);
    } finally {
      setBusy(false);
    }
  };

  const saveSrsSpecification = async (
    record: SpecificationRecord,
    content: FunctionalSpecification | NonFunctionalSpecification,
  ) => {
    setBusy(true);
    setError("");
    try {
      await updateSpecification(record.id, content);
      await refreshSrsDocument();
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

  const B1 = (
    <div className="space-y-5">
      <Card
        tone="plain"
        title="Nhập yêu cầu người dùng"
      >
        <RequirementFormFields
          value={newRequirement}
          onChange={changeNewField}
          preConditions={newRequirement.preConditions}
          businessRules={newRequirement.businessRules}
          onChangeList={changeNewList}
          error={error}
          checkLabel={busy ? "Đang lưu..." : "Thêm vào danh sách"}
          disabled={busy || !loaded}
          onCheck={() => void addRequirement()}
        />
      </Card>
      <Card
        title="Yêu cầu đã lưu"
        actions={        <StatusBadge tone={requirements.length ? "success" : "muted"}>{requirements.length} mục</StatusBadge>}
      >
        {requirements.length === 0 ? (
          <EmptyState title="Chưa có yêu cầu" hint="Thêm ít nhất một yêu cầu để tiếp tục." />
        ) : (
          <ul className="space-y-2">
            {requirements.map((item) => {
              const rawValue = requirementValues[item.id];
              return (
                <li key={item.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="min-w-0 flex-1">
                    <p className={`break-words text-sm font-medium text-slate-800 ${wrapClass}`}>
                      {rawValue ? requirementTitle(rawValue) : `Yêu cầu ${item.id}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.status === "draft" ? "Bản nháp" : "Đã xác nhận"}
                    </p>
                  </div>
                  {item.status === "draft" && (
                    <RemoveButton
                      label={`Xóa yêu cầu ${item.id}`}
                      onClick={() => void removeRequirement(item.id)}
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
                onClick={() => void checkRequirementCoverage()}
              >
                {loadingCoverage ? "Đang kiểm tra..." : "Kiểm tra chức năng"}
              </SoftButton>
            }
          >
            {!coverageAnalysis ? (
              <p className="text-sm text-slate-600">
                Kiểm tra trước khi sang Bước 2 để xem hệ thống còn thiếu chức năng nào.
              </p>
            ) : (
              <div className="space-y-4">
                <p
                  role="status"
                  className={`rounded-lg p-3 text-sm ${
                    coverageAnalysis.is_sufficient
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {coverageAnalysis.summary}
                </p>
                {addedCoverageSuggestions.length > 0 && (
                  <p className="text-xs text-emerald-700">
                    Đã thêm {addedCoverageSuggestions.length} chức năng được chọn. Kết quả kiểm tra phía trên dựa trên danh sách trước khi bổ sung.
                  </p>
                )}
                {coverageAnalysis.suggestions.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-800">
                      Chức năng AI đề xuất còn thiếu
                    </h4>
                    {coverageAnalysis.suggestions.map((suggestion, index) => {
                      const alreadyAdded = addedCoverageSuggestions.includes(index);
                      return (
                        <label
                          key={`${suggestion.action}-${suggestion.target_object}-${index}`}
                          className={`flex gap-3 rounded-xl border p-3 ${
                            alreadyAdded
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Chọn chức năng ${suggestion.action} ${suggestion.target_object}`}
                            checked={!alreadyAdded && Boolean(selectedCoverageSuggestions[index])}
                            disabled={busy || alreadyAdded}
                            onChange={(event) => setSelectedCoverageSuggestions((previous) => ({
                              ...previous,
                              [index]: event.target.checked,
                            }))}
                            className="mt-1 h-4 w-4 shrink-0 accent-violet-600"
                          />
                          <span className="min-w-0 text-sm text-slate-700">
                            <span className={`block font-medium ${wrapClass}`}>
                              {suggestion.actor}: {suggestion.action} {suggestion.target_object}
                            </span>
                            <span className={`mt-1 block text-slate-600 ${wrapClass}`}>
                              Mục đích: {suggestion.purpose}
                            </span>
                            <span className={`mt-1 block text-xs text-slate-500 ${wrapClass}`}>
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
                          onClick={() => void addSelectedCoverageSuggestions()}
                        >
                          Thêm {selectedCoverageIndexes.length} chức năng đã chọn
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
            disabled={busy || !loaded || !coverageAnalysis || selectedCoverageIndexes.length > 0}
            onClick={() => onStepChange(2)}
          >
            Tiếp tục sang Bước 2
          </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );

  const B2 = (
    <Card
      tone="amber"
      title="Phân tích và phát hiện thiếu sót"
      actions={
        <SoftButton disabled={busy || loadingAnalysis || draftRequirements.length === 0} onClick={() => void runBatchAnalysis()}>
          Phân tích lại tất cả yêu cầu
        </SoftButton>
      }
    >
      {loadingAnalysis ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Đang phân tích {draftRequirements.length} yêu cầu...
        </p>
      ) : draftRequirements.length === 0 ? (
        <EmptyState title="Không có yêu cầu bản nháp" hint="Quay lại Bước 1 để thêm yêu cầu hoặc tiếp tục tới Bước 3." />
      ) : (
        <div className="space-y-4">
          {draftRequirements.map((item) => {
            const analysis = analyses[item.id];
            const rawValue = requirementValues[item.id];
            return (
              <article key={item.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className={`min-w-0 flex-1 break-words text-sm font-semibold text-slate-900 ${wrapClass}`}>
                    {rawValue ? requirementTitle(rawValue) : `Yêu cầu ${item.id}`}
                  </h3>
                  {analysis ? (
                    <StatusBadge tone={analysis.is_complete ? "success" : "warn"}>
                      {analysis.is_complete ? "Đủ" : "Thiếu"}
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="muted">Chưa có kết quả</StatusBadge>
                  )}
                </div>
                {analysis && !analysis.is_complete && (
                  <div className="mt-3 space-y-2 text-sm text-amber-900">
                    <ul className="list-disc space-y-1 pl-5">
                      {analysis.missing_elements.map((element) => <li key={element}>{element}</li>)}
                    </ul>
                    <p className={`rounded-lg bg-amber-50 p-3 ${wrapClass}`}>{analysis.feedback}</p>
                  </div>
                )}
                {analysis?.is_complete && (
                  <p className={`mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 ${wrapClass}`}>
                    {analysis.feedback || "Yêu cầu có đủ thông tin để tiếp tục."}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <PrimaryButton disabled={busy || loadingAnalysis} onClick={() => onStepChange(3)}>
          Tiếp tục sang Bước 3
        </PrimaryButton>
      </div>
    </Card>
  );

  const B3 = (
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
                  const rawValue = requirementValues[item.id] ?? emptyRequirement();
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

  const B4 = (
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
                        : [...previous, story.id],
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GhostButton onClick={() => onStepChange(3)}>Quay lại Bước 3</GhostButton>
        <PrimaryButton
          disabled={busy || stories.length === 0 || stories.some((story) =>
            !specifications.some((item) => item.user_story_id === story.id && item.type === "functional"),
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
                  <SoftButton
                    disabled={busy || !projectId}
                    onClick={() => void createNonFunctionalSpecification()}
                  >
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
                  <SoftButton
                    disabled={busy}
                    onClick={() => void createNonFunctionalSpecification(true)}
                  >
                    Tạo lại bằng AI
                  </SoftButton>
                  <PrimaryButton
                    disabled={busy}
                    onClick={() => void saveSpecification(
                      specification,
                      specDrafts[specification.id] as NonFunctionalSpecification ??
                        parseSpecification(specification.content, emptyNonFunctionalSpecification()),
                    )}
                  >
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

  const B5 = (
    <Buoc5TaiLieuSRS
      srsMetadataDirty={srsMetadataDirty}
      srsMetadata={srsMetadata}
      srsMarkdown={srsMarkdown}
      specifications={specifications}
      srsFunctionalForEditor={srsFunctionalForEditor}
      srsNonFunctionalForEditor={srsNonFunctionalForEditor}
      busy={busy}
      onStepChange={onStepChange}
      saveSrsMetadataDraft={saveSrsMetadataDraft}
      exportSrs={exportSrs}
      saveSrsSpecification={saveSrsSpecification}
      setSrsMetadata={setSrsMetadata}
      setSrsSpecDrafts={setSrsSpecDrafts}
    />
  );

  return (
    <div className="relative">
      {aiTaskLabel && <ProgressOverlay label={aiTaskLabel} />}
      <div className="relative z-10 mx-auto max-w-5xl space-y-6 px-4 py-8">
        <StepHeading step={`Bước ${step} / 5`} title={definition.label} icon={definition.icon} />
        {!loaded && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Đang tải dữ liệu từ cơ sở dữ liệu...
          </p>
        )}
        {(error || (!projectId ? "Dự án chưa có ID hợp lệ trong cơ sở dữ liệu." : "")) && (
          <div role="alert" className="break-words rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 [overflow-wrap:anywhere]">
            {error || "Dự án chưa có ID hợp lệ trong cơ sở dữ liệu."}
          </div>
        )}
        {loaded && step === 1 && B1}
        {loaded && step === 2 && B2}
        {loaded && step === 3 && B3}
        {loaded && step === 4 && B4}
        {loaded && step === 5 && B5}
      </div>
    </div>
  );
}
