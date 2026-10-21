import { useEffect, useMemo, useState } from "react";
import type {
  InteractionType,
  Relation,
  Scenario,
  UmlClass,
  WorkflowState,
} from "../../../types/workflow";
import {
  readUmlConfirmations,
  writeUmlConfirmations,
  type UmlConfirmationState,
} from "./umlConfirmationStorage";
import {
  deleteClass,
  extractProjectActorsUseCasesBatch,
  generateClasses,
  generateClassDiagram,
  generateInteractionDiagram,
  generateProjectInteractionDiagramsBatch,
  generateProjectScenariosBatch,
  generateScenario,
  generateUseCaseDiagram,
  getProjectUmlState,
  listProjectSpecificationsForUml,
  regenerateUseCaseDiagramFromCode,
  saveProjectActorUseCasesBatch,
  updateClass,
  updateDiagram,
  updateUseCaseScenario,
  type ExtractedSuggestions,
  type ProjectSpecificationRecord,
  type ProjectUmlState,
  type UseCaseRecord,
} from "../../../services/umlService";
import {
  Card,
  Notice,
  PrimaryButton,
  SoftButton,
  inputClass,
  wrapClass,
} from "../../common/ui/primitives";
import ProgressOverlay from "../../common/ProgressOverlay";
import Step1ActorUseCase from "./steps/Step1ActorUseCase";
import Step2UseCaseDiagram from "./steps/Step2UseCaseDiagram";
import Step3UseCaseScenario from "./steps/Step3UseCaseScenario";
import Step4InteractionDiagram from "./steps/Step4InteractionDiagram";
import Step5ClassDiagram from "./steps/Step5ClassDiagram";

interface Props {
  projectId?: number;
  state: WorkflowState;
  setState: (updater: (prev: WorkflowState) => WorkflowState) => void;
  step: number;
  onStepChange: (step: number) => void;
  onReturnStage1?: () => void;
}

interface SuggestedActor {
  token: string;
  name: string;
}

interface SuggestedUseCase {
  token: string;
  specification_id: number;
  name: string;
  description: string;
}

interface SuggestionState {
  actors: SuggestedActor[];
  useCases: SuggestedUseCase[];
}

interface ClassDraft {
  name: string;
  attributes: string[];
  methods: string[];
}

const UML_LOAD_TIMEOUT_MS = 15000;

function allScenariosReady(useCases: WorkflowState["usecases"], scenarios: WorkflowState["scenarios"]): boolean {
  return useCases.length > 0 && useCases.every((useCase) => {
    const scenario = scenarios[useCase.id];
    return Boolean(scenario && (scenario.mainFlow.length > 0 || scenario.altFlows.length > 0 || scenario.exceptions.length > 0));
  });
}

function allInteractionsReady(useCases: WorkflowState["usecases"], interactions: WorkflowState["interactions"]): boolean {
  return useCases.length > 0 && useCases.every((useCase) =>
    interactions.some((diagram) => diagram.usecaseId === useCase.id && Boolean(diagram.imageUrl) && Boolean(diagram.sourceCode?.trim())),
  );
}

function ReviewRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
      <span>{label}</span>
      <span className={ok ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
        {ok ? "Đã xác nhận" : "Chưa hoàn tất"}
      </span>
    </div>
  );
}

function explainError(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Đã xảy ra lỗi không xác định.";
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function toScenario(record: UseCaseRecord): Scenario {
  return {
    mainFlow: asArray(record?.main_flow),
    altFlows: asArray(record?.alt_flow),
    exceptions: asArray(record?.exception_flow),
  };
}

function hydrateState(saved: ProjectUmlState, previous: WorkflowState): WorkflowState {
  const actors = asArray(saved?.actors);
  const useCases = asArray(saved?.use_cases);
  const relations = asArray(saved?.relations);
  const diagrams = asArray(saved?.diagrams);
  const classes = asArray(saved?.classes);
  const classRelations = asArray(saved?.class_relations);

  const actorById = new Map(actors.map((actor) => [actor.id, actor.name]));
  const useCaseById = new Map(useCases.map((useCase) => [useCase.id, useCase.name]));

  // Với mỗi (use case, loại biểu đồ tương tác) chỉ giữ bản mới nhất.
  const diagramByUseCaseAndType = new Map<string, (typeof diagrams)[number]>();
  for (const diagram of diagrams) {
    if (
      diagram.use_case_id !== null &&
      (diagram.type === "sequence" || diagram.type === "collaboration")
    ) {
      const key = `${diagram.use_case_id}:${diagram.type}`;
      const old = diagramByUseCaseAndType.get(key);
      if (!old || old.id < diagram.id) diagramByUseCaseAndType.set(key, diagram);
    }
  }

  const umlRelations: Relation[] = relations.flatMap((relation) => {
    const from = actorById.get(relation.actor_id);
    const to = useCaseById.get(relation.use_case_id);
    return from && to ? [{ id: relation.id, from, to, type: relation.relation_type }] : [];
  });

  const classById = new Map(classes.map((item) => [item.id, item.name]));
  for (const relation of classRelations) {
    const from = classById.get(relation.class_a_id);
    const to = classById.get(relation.class_b_id);
    if (from && to) {
      umlRelations.push({ id: relation.id, from, to, type: relation.relation_type });
    }
  }

  const useCaseDiagram = diagrams
    .filter((diagram) => diagram.type === "use_case" && diagram.use_case_id === null)
    .at(-1);
  const classDiagram = diagrams
    .filter((diagram) => diagram.type === "class" && diagram.use_case_id === null)
    .at(-1);

  return {
    ...previous,
    actors: actors.map(({ id, name }) => ({ id, name })),
    usecases: useCases.map(({ id, name, specification_id }) => ({
      id,
      name,
      description: "",
      specificationId: specification_id,
    })),
    scenarios: Object.fromEntries(
      useCases
        .filter((useCase) => {
          const scenario = toScenario(useCase);
          return (
            scenario.mainFlow.length > 0 ||
            scenario.altFlows.length > 0 ||
            scenario.exceptions.length > 0
          );
        })
        .map((useCase) => [useCase.id, toScenario(useCase)]),
    ),
    useCaseDiagramUrl: useCaseDiagram?.image_url ?? null,
    useCaseDiagramCode: useCaseDiagram?.source_code ?? null,
    interactions: [...diagramByUseCaseAndType.values()].flatMap((diagram) =>
      diagram.use_case_id === null
        ? []
        : [
            {
              usecaseId: diagram.use_case_id,
              type: diagram.type as InteractionType,
              imageUrl: diagram.image_url,
              sourceCode: diagram.source_code,
            },
          ],
    ),
    umlClasses: classes.map<UmlClass>((item) => ({
      id: item.id,
      name: item.name,
      attributes: asArray(item.attributes),
      methods: asArray(item.methods),
    })),
    classDiagramUrl: classDiagram?.image_url ?? null,
    classDiagramCode: classDiagram?.source_code ?? null,
    relations: umlRelations,
  };
}

function mapSuggestions(result: ExtractedSuggestions): SuggestionState {
  return {
    actors: result.suggested_actors.map((item, index) => ({
      token: `actor-${index}`,
      name: item.name,
    })),
    useCases: result.suggested_use_cases.map((item, index) => ({
      token: `uc-${item.specification_id}-${index}`,
      specification_id: item.specification_id,
      name: item.name,
      description: item.description,
    })),
  };
}

export default function GiaiDoan2({
  projectId,
  state,
  setState,
  step,
  onStepChange,
  onReturnStage1,
}: Props) {
  const [loadedProjectId, setLoadedProjectId] = useState<number | undefined>();
  const [umlLoadSucceeded, setUmlLoadSucceeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiTaskLabel, setAiTaskLabel] = useState("");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionState>({ actors: [], useCases: [] });
  const [diagramType, setDiagramType] = useState<InteractionType>("sequence");
  const [specifications, setSpecifications] = useState<ProjectSpecificationRecord[] | null>(null);
  const [specificationError, setSpecificationError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [, setClassDrafts] = useState<Record<number, ClassDraft>>({});


  const scenarios = useMemo(
    () => state.usecases.filter((useCase) => state.scenarios[useCase.id]?.mainFlow.length),
    [state.scenarios, state.usecases],
  );

  async function refreshSavedState(): Promise<void> {
    if (!projectId) return;
    const saved = await getProjectUmlState(projectId);
    setState((previous) => hydrateState(saved, previous));
  }

  // Tải trạng thái UML của dự án.
  useEffect(() => {
    let cancelled = false;
    if (!projectId) return () => { cancelled = true; };
    setLoadedProjectId(undefined);
    setUmlLoadSucceeded(false);
    setError("");
    const guard = setTimeout(() => {
      if (!cancelled) {
        setError("Không tải được dữ liệu UML trong thời gian chờ. Hãy thử lại.");
        setLoadedProjectId(projectId);
      }
    }, UML_LOAD_TIMEOUT_MS);
    const load = async () => {
      try {
        const saved = await getProjectUmlState(projectId);
        if (!cancelled) {
          const savedConfirmations = readUmlConfirmations(projectId);
          setState((previous) => ({
            ...hydrateState(saved, previous),
            ...savedConfirmations,
          }));
          const lastInteractionDiagram = asArray(saved?.diagrams)
            .filter((item) => item.type === "sequence" || item.type === "collaboration")
            .at(-1);
          setDiagramType(
            lastInteractionDiagram?.type === "collaboration" ? "collaboration" : "sequence",
          );
          setUmlLoadSucceeded(true);
        }
      } catch (reason: unknown) {
        if (!cancelled) {
          setError(`Không thể tải dữ liệu UML từ database: ${explainError(reason)}`);
        }
      } finally {
        clearTimeout(guard);
        if (!cancelled) setLoadedProjectId(projectId);
      }
    };
    void load();
    return () => { cancelled = true; clearTimeout(guard); };
  }, [projectId, setState, reloadToken]);

  // Lưu riêng các xác nhận UI theo dự án để không mất khi chuyển bước/tải lại.
  // Không ghi khi dữ liệu UML chưa tải xong, tránh ghi đè xác nhận cũ bằng false mặc định.
  useEffect(() => {
    if (!projectId || loadedProjectId !== projectId || !umlLoadSucceeded) return;
    const confirmations: UmlConfirmationState = {
      actorsUseCasesConfirmed: state.actorsUseCasesConfirmed,
      useCaseDiagramConfirmed: state.useCaseDiagramConfirmed,
      scenariosConfirmed: state.scenariosConfirmed,
      interactionsConfirmed: state.interactionsConfirmed,
      classDiagramConfirmed: state.classDiagramConfirmed,
    };
    try {
      writeUmlConfirmations(projectId, confirmations);
    } catch {
      // Nếu trình duyệt chặn lưu trữ, các xác nhận vẫn hoạt động trong phiên hiện tại.
    }
  }, [
    projectId,
    loadedProjectId,
    umlLoadSucceeded,
    state.actorsUseCasesConfirmed,
    state.useCaseDiagramConfirmed,
    state.scenariosConfirmed,
    state.interactionsConfirmed,
    state.classDiagramConfirmed,
  ]);

  // Kiểm tra đặc tả của dự án.
  useEffect(() => {
    let cancelled = false;
    setSpecifications(null);
    setSpecificationError("");
    if (!projectId) return () => { cancelled = true; };
    const load = async () => {
      try {
        const list = await listProjectSpecificationsForUml(projectId);
        if (!cancelled) setSpecifications(asArray(list));
      } catch (reason: unknown) {
        if (!cancelled) {
          setSpecifications(null);
          setSpecificationError(
            `Không kiểm tra được đặc tả của dự án: ${explainError(reason)}`,
          );
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [projectId, reloadToken]);

  async function runAction(action: () => Promise<void>, aiLabel?: string): Promise<void> {
    setError("");
    setBusy(true);
    setAiTaskLabel(aiLabel ?? "");
    try {
      await action();
    } catch (reason) {
      setError(explainError(reason));
    } finally {
      setBusy(false);
      setAiTaskLabel("");
    }
  }

  function regenerate(_label: string, _title: string, _hasExisting: boolean, run: () => void) {
    run();
  }

  function updateScenario(useCaseId: number, field: keyof Scenario, lines: string[]) {
    setState((previous) => ({
      ...previous,
      scenariosConfirmed: false,
      interactionsConfirmed: false,
      classDiagramConfirmed: false,
      scenarios: {
        ...previous.scenarios,
        [useCaseId]: {
          ...(previous.scenarios[useCaseId] ?? { mainFlow: [], altFlows: [], exceptions: [] }),
          [field]: lines,
        },
      },
    }));
  }

  async function runExtract(): Promise<void> {
    if (!projectId) return;
    const result = await extractProjectActorsUseCasesBatch(projectId);
    setSuggestions(mapSuggestions(result));
  }

  async function saveActorUseCaseSuggestions(): Promise<void> {
    if (!projectId || (!suggestions.actors.length && !suggestions.useCases.length)) return;
    await saveProjectActorUseCasesBatch(projectId, {
      actors: suggestions.actors.map(({ name }) => ({ name })),
      use_cases: suggestions.useCases.map(({ specification_id, name }) => ({ specification_id, name })),
      relations: [],
    });
    setSuggestions({ actors: [], useCases: [] });
    await refreshSavedState();
  }

  async function runGenerateClasses(): Promise<void> {
    if (!projectId) return;
    const classes = await generateClasses(projectId);
    setState((previous) => ({
      ...previous,
      classDiagramConfirmed: false,
      umlClasses: classes.map((item) => ({
        id: item.id,
        name: item.name,
        attributes: item.attributes,
        methods: item.methods,
      })),
    }));
    const diagram = await generateClassDiagram(projectId);
    setState((previous) => ({
      ...previous,
      classDiagramConfirmed: false,
      classDiagramUrl: diagram.image_url,
      classDiagramCode: diagram.source_code,
    }));
  }

  const step1 = (
    <Step1ActorUseCase
      projectId={projectId}
      requirements={state.actors}
      requirementValues={state.usecases}
      analyses={suggestions}
      loadingAnalysis={busy}
      busy={busy}
      loaded={loadedProjectId !== undefined}
      error={error}
      runBatchAnalysis={() => runAction(runExtract, "Đang phân tích đặc tả chức năng...")}
      onSaveSuggestions={() => runAction(saveActorUseCaseSuggestions, "Đang lưu Actor và Use Case...")}
      confirmed={state.actorsUseCasesConfirmed}
      onConfirm={() =>
        setState((previous) => ({
          ...previous,
          actorsUseCasesConfirmed: true,
          useCaseDiagramConfirmed: false,
          scenariosConfirmed: false,
          interactionsConfirmed: false,
          classDiagramConfirmed: false,
        }))
      }
      onStepChange={onStepChange}
      requirementTitle={(raw: any) => raw.name}
      wrapClass={wrapClass}
    />
  );

  const step2 = (
    <Step2UseCaseDiagram
      imageUrl={state.useCaseDiagramUrl}
      imageCode={state.useCaseDiagramCode}
      confirmed={state.useCaseDiagramConfirmed}
      busy={busy}
      projectId={projectId}
      onRegenerate={() =>
        regenerate(
          "Sinh lại biểu đồ",
          "Ghi đè biểu đồ use case?",
          Boolean(state.useCaseDiagramCode || state.useCaseDiagramUrl),
          () =>
            void runAction(async () => {
              const diagram = await generateUseCaseDiagram(projectId!);
              setState((previous) => ({
                ...previous,
                useCaseDiagramUrl: diagram.image_url,
                useCaseDiagramCode: diagram.source_code,
                useCaseDiagramConfirmed: false,
                scenariosConfirmed: false,
                interactionsConfirmed: false,
                classDiagramConfirmed: false,
              }));
            }, "Đang sinh biểu đồ use case..."),
        )
      }
      onSave={(nextCode) =>
        void runAction(async () => {
          const diagram = await regenerateUseCaseDiagramFromCode(projectId!, nextCode);
          setState((previous) => ({
            ...previous,
            useCaseDiagramUrl: diagram.image_url,
            useCaseDiagramCode: diagram.source_code,
            useCaseDiagramConfirmed: false,
            scenariosConfirmed: false,
            interactionsConfirmed: false,
            classDiagramConfirmed: false,
          }));
        }, "Đang render lại từ mã đã sửa...")
      }
      onConfirm={() => setState((previous) => ({
        ...previous,
        useCaseDiagramConfirmed: true,
        scenariosConfirmed: false,
        interactionsConfirmed: false,
        classDiagramConfirmed: false,
      }))}
      onStepChange={onStepChange}
    />
  );

  const step3 = (
    <Step3UseCaseScenario
      projectId={projectId}
      useCases={state.usecases}
      scenarios={state.scenarios}
      updateScenario={updateScenario}
      busy={busy}
      onGenerateBatch={() =>
        void runAction(async () => {
          const result = await generateProjectScenariosBatch(projectId!);
          setState((previous) => ({
            ...previous,
            scenariosConfirmed: false,
            scenarios: {
              ...previous.scenarios,
              ...Object.fromEntries(
                result.results.map((item) => [
                  item.use_case_id,
                  {
                    mainFlow: item.main_flow,
                    altFlows: item.alt_flow,
                    exceptions: item.exception_flow,
                  },
                ]),
              ),
            },
          }));
          await refreshSavedState();
        }, "Đang sinh kịch bản use case...")
      }
      onGenerateSingle={(useCaseId) =>
        runAction(async () => {
          await generateScenario(useCaseId);
          await refreshSavedState();
          setState((previous) => ({ ...previous, scenariosConfirmed: false }));
        }, "Đang sinh kịch bản use case...")
      }
      onSaveScenario={(useCaseId) =>
        runAction(async () => {
          const scenario = state.scenarios[useCaseId];
          if (!scenario) return;
          await updateUseCaseScenario(useCaseId, {
            mainFlow: scenario.mainFlow.map((line) => line.trim()).filter(Boolean),
            altFlows: scenario.altFlows.map((line) => line.trim()).filter(Boolean),
            exceptions: scenario.exceptions.map((line) => line.trim()).filter(Boolean),
          });
          await refreshSavedState();
        }, "Đang lưu kịch bản use case...")
      }
      confirmAll={() => setState((previous) => ({
        ...previous,
        scenariosConfirmed: true,
        interactionsConfirmed: false,
        classDiagramConfirmed: false,
      }))}
      confirmed={state.scenariosConfirmed}
      onStepChange={onStepChange}
      wrapClass={wrapClass}
    />
  );

  const step4 = (
    <Step4InteractionDiagram
      scenarios={scenarios}
      interactions={state.interactions.map((diagram) => ({
        ...diagram,
        sourceCode: diagram.sourceCode ?? null,
      }))}
      currentDiagramType={diagramType}
      setDiagramType={(nextType) => {
        // Chọn lại tab đang hoạt động không làm thay đổi mô hình, vì vậy
        // không được thu hồi xác nhận chỉ vì người dùng bấm lại cùng loại biểu đồ.
        if (nextType === diagramType) return;
        setDiagramType(nextType);
        setState((previous) => ({
          ...previous,
          interactionsConfirmed: false,
          classDiagramConfirmed: false,
        }));
      }}
      busy={busy}
      projectId={projectId}
      onGenerateBatch={() =>
        void runAction(async () => {
          await generateProjectInteractionDiagramsBatch(projectId!, diagramType);
          await refreshSavedState();
          setState((previous) => ({ ...previous, interactionsConfirmed: false }));
        }, "Đang sinh biểu đồ tương tác cho các use case...")
      }
      onGenerateSingle={async (id) => {
        await runAction(async () => {
          await generateInteractionDiagram(id, diagramType);
          await refreshSavedState();
          setState((previous) => ({ ...previous, interactionsConfirmed: false }));
        }, "Đang sinh biểu đồ tương tác...");
      }}
      onSaveDiagram={async (id, code) => {
        await runAction(async () => {
          await updateDiagram(id, code);
          await refreshSavedState();
          setState((previous) => ({ ...previous, interactionsConfirmed: false }));
        }, "Đang render lại từ mã đã sửa...");
      }}
      onConfirm={() => setState((previous) => ({
        ...previous,
        interactionsConfirmed: true,
        classDiagramConfirmed: false,
      }))}
      confirmed={state.interactionsConfirmed}
      onStepChange={onStepChange}
      wrapClass={wrapClass}
      inputClass={inputClass}
    />
  );

  const step5 = (
    <Step5ClassDiagram
      umlClasses={state.umlClasses}
      classDiagramUrl={state.classDiagramUrl}
      classDiagramCode={state.classDiagramCode}
      editingClassId={editingClassId}
      setEditingClassId={setEditingClassId}
      setEditingClassDraft={(id, draft) => setClassDrafts((prev) => ({ ...prev, [id]: draft }))}
      onSaveClass={async (id, draft) => {
        await runAction(async () => {
          const saved = await updateClass(id, {
            name: draft.name.trim(),
            attributes: draft.attributes.map((line) => line.trim()).filter(Boolean),
            methods: draft.methods.map((line) => line.trim()).filter(Boolean),
          });
          setState((previous) => ({
            ...previous,
            classDiagramConfirmed: false,
            umlClasses: previous.umlClasses.map((item) =>
              item.id === saved.id
                ? {
                    id: saved.id,
                    name: saved.name,
                    attributes: saved.attributes,
                    methods: saved.methods,
                  }
                : item,
            ),
          }));
          setEditingClassId(null);
        }, "Đang lưu lớp...");
      }}
      onDeleteClass={async (id) => {
        await runAction(async () => {
          await deleteClass(id);
          setState((previous) => ({
            ...previous,
            classDiagramConfirmed: false,
            umlClasses: previous.umlClasses.filter((item) => item.id !== id),
          }));
          setEditingClassId(null);
        }, "Đang xoá lớp...");
      }}
      onRegenerateClasses={() =>
        void runAction(runGenerateClasses, "Đang suy luận và sinh biểu đồ lớp...")
      }
      onConfirmClassDiagram={() =>
        setState((previous) => ({ ...previous, classDiagramConfirmed: true }))
      }
      busy={busy}
      projectId={projectId}
      wrapClass={wrapClass}
    />
  );

  if (projectId && loadedProjectId !== projectId) {
    return (
      <div className="w-full max-w-none px-4 py-8 sm:px-6 lg:px-8 text-center text-sm text-slate-500">
        Đang tải dữ liệu UML từ database...
      </div>
    );
  }

  const hasFunctionalSpecification = specifications?.some((item) => item.type === "functional");

  if (specifications && !hasFunctionalSpecification) {
    const hasAnySpecification = specifications.length > 0;
    return (
      <div className="w-full max-w-none px-4 py-8 sm:px-6 lg:px-8">
        <Card
          tone="amber"
          title={hasAnySpecification ? "Dự án chưa có đặc tả chức năng" : "Dự án chưa có đặc tả"}
        >
          <p className="text-sm text-slate-700">
            {hasAnySpecification ? (
              <>
                Dự án chỉ có đặc tả phi chức năng. Tác nhân và use case chỉ được sinh từ đặc tả
                chức năng, nên chưa thể chuyển sang mô hình hóa UML. Vui lòng bổ sung{" "}
                <strong>đặc tả chức năng</strong> ở Giai đoạn 1 trước.
              </>
            ) : (
              <>
                Dự án này chưa có đặc tả nào trong database, nên chưa thể chuyển sang mô hình hóa
                UML. Vui lòng hoàn thành <strong>Giai đoạn 1: Thu thập và Đặc tả</strong> trước.
              </>
            )}
          </p>
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>Vào Giai đoạn 1, nhập và phân tích yêu cầu.</li>
            <li>Kiểm duyệt và xác nhận user story.</li>
            <li>Sinh đặc tả chức năng cho từng user story.</li>
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            {onReturnStage1 && (
              <PrimaryButton onClick={onReturnStage1}>← Quay lại Giai đoạn 1</PrimaryButton>
            )}
            <SoftButton onClick={() => setReloadToken((token) => token + 1)}>
              Tải lại dữ liệu
            </SoftButton>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      {aiTaskLabel && <ProgressOverlay label={aiTaskLabel} />}
      <div className="relative z-10 w-full max-w-none space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {specificationError && <Notice tone="warn">{specificationError}</Notice>}
        {error && <Notice tone="danger">{error}</Notice>}
        {step === 1 && step1}
        {step === 2 && step3}
        {step === 3 && step2}
        {step === 4 && step5}
        {step === 5 && step4}
        {step === 6 && (
          <Card title="Trạng thái và kiểm tra bộ mô hình UML">
            <p className="mb-4 text-sm text-slate-600">
              Rà soát tính đầy đủ của các sản phẩm. Mỗi sản phẩm được lưu ở bước tạo hoặc chỉnh sửa; không cần xác nhận toàn bộ để chuyển bước.
            </p>
            <div className="space-y-2 text-sm">
              <ReviewRow label={`Actor và Use Case (${state.actors.length} tác nhân, ${state.usecases.length} use case)`} ok={state.actors.length > 0 && state.usecases.length > 0} />
              <ReviewRow label="Biểu đồ Use Case có mã và ảnh" ok={Boolean(state.useCaseDiagramUrl && state.useCaseDiagramCode?.trim())} />
              <ReviewRow label={`Kịch bản Use Case (${state.usecases.filter((uc) => { const sc = state.scenarios[uc.id]; return Boolean(sc && (sc.mainFlow.length || sc.altFlows.length || sc.exceptions.length)); }).length}/${state.usecases.length})`} ok={allScenariosReady(state.usecases, state.scenarios)} />
              <ReviewRow label={`Biểu đồ tương tác (${state.usecases.filter((uc) => state.interactions.some((d) => d.usecaseId === uc.id && Boolean(d.imageUrl) && Boolean(d.sourceCode?.trim()))).length}/${state.usecases.length})`} ok={allInteractionsReady(state.usecases, state.interactions)} />
              <ReviewRow label={`Domain Model và Class Diagram (${state.umlClasses.length} lớp)`} ok={state.umlClasses.length > 0 && Boolean(state.classDiagramUrl && state.classDiagramCode?.trim())} />
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Kết quả rà soát</h3>
              {(!state.actors.length || !state.usecases.length || !state.useCaseDiagramUrl || !state.useCaseDiagramCode?.trim() || !allScenariosReady(state.usecases, state.scenarios) || !allInteractionsReady(state.usecases, state.interactions) || !state.umlClasses.length || !state.classDiagramUrl || !state.classDiagramCode?.trim()) ? (
                <p className="mt-1 text-sm text-slate-600">Còn sản phẩm chưa hoàn tất. Quay lại đúng bước qua thanh điều hướng để bổ sung; dữ liệu đã lưu ở các bước khác vẫn được giữ nguyên.</p>
              ) : (
                <p className="mt-1 text-sm text-emerald-700">Đã có đủ các sản phẩm UML chính. Có thể chuyển sang Giai đoạn 3 để đồng bộ SRS và UML.</p>
              )}
              <p className="mt-2 text-xs text-slate-500">State Machine có thể bổ sung khi hệ thống có đối tượng với vòng đời trạng thái rõ ràng; không bắt buộc với mọi use case.</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

