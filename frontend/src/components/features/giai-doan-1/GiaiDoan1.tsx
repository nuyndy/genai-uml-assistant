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
} from "../../../services/requirementService";
import type { RawRequirement, SpecDoc, WorkflowState } from "../../../types/workflow";
import { STAGES } from "../../../stages";
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
import { StepHeading, inputClass, wrapClass } from "../../common/ui/primitives";

interface Props {
  projectId?: number;
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
    useState<Record<number, string>>({});
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
  const storyPreviewKey = useRef("");
  const autoGenerationAttempts = useRef(new Set<string>());
  const generationInFlight = useRef(new Set<string>());

  // Lưu ý: kiểm tra stages/index.ts xem chỉ số 1 có đúng là Giai đoạn 1 không.
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

  const resetCoverage = () => {
    setCoverageAnalysis(null);
    setSelectedCoverageSuggestions({});
    setAddedCoverageSuggestions([]);
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
      resetCoverage();
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
        selectedSuggestions.map(
          ({ actor, action, target_object, purpose, pre_conditions, business_rules }) => ({
            actor,
            action,
            target_object,
            purpose,
            pre_conditions,
            business_rules,
          }),
        ),
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

  // Bước 4: tự sinh đặc tả còn thiếu (mỗi mục chỉ thử tự động một lần).
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
      selectedCoverageSuggestions={selectedCoverageSuggestions}
      selectedCoverageIndexes={selectedCoverageIndexes}
      onChangeNewField={changeNewField}
      onChangeNewList={changeNewList}
      onAddRequirement={addRequirement}
      onRemoveRequirement={removeRequirement}
      onCheckCoverage={checkRequirementCoverage}
      onAddSelectedCoverage={addSelectedCoverageSuggestions}
      onStepChange={onStepChange}
      requirementTitle={requirementTitle}
    />
  );

  const step2 = (
    <Step2PhanTichYeuCau
      projectId={projectId}
      requirements={requirements}
      requirementValues={requirementValues}
      analyses={analyses}
      loadingAnalysis={loadingAnalysis}
      busy={busy}
      loaded={loaded}
      error={error}
      runBatchAnalysis={runBatchAnalysis}
      onStepChange={onStepChange}
      requirementTitle={requirementTitle}
      wrapClass={wrapClass}
    />
  );

  const step3 = (
    <Step3UserStory
      projectId={projectId}
      draftRequirements={draftRequirements}
      requirementValues={requirementValues}
      storyDrafts={storyDrafts}
      loadingStoryDrafts={loadingStoryDrafts}
      busy={busy}
      loaded={loaded}
      error={error}
      allStoryDraftsReady={allStoryDraftsReady}
      allRequirementsConfirmed={allRequirementsConfirmed}
      generateStoryDrafts={generateStoryDrafts}
      changeStoryDraft={changeStoryDraft}
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
      createNonFunctionalSpecification={createNonFunctionalSpecification}
      onStepChange={onStepChange}
      wrapClass={wrapClass}
      inputClass={inputClass}
    />
  );

  const step5 = (
    <Step5ChotTaiLieu
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

  const missingProjectMessage = projectId ? "" : "Dự án chưa có ID hợp lệ trong cơ sở dữ liệu.";
  const alertMessage = error || missingProjectMessage;

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