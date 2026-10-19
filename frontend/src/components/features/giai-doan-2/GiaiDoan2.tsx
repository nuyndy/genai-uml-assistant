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
import { STAGES } from "../../../stages";
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
  GhostButton,
  Notice,
  PrimaryButton,
  SoftButton,
  StepHeading,
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
  const [pendingRegenerate, setPendingRegenerate] = useState<(() => void) | null>(null);
  const [regenerateTitle, setRegenerateTitle] = useState("");
  const [regenerateLabel, setRegenerateLabel] = useState("");
  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [, setClassDrafts] = useState<Record<number, ClassDraft>>({});

  const def = STAGES[2].steps[step - 1] ?? STAGES[2].steps[0];

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

  function regenerate(label: string, title: string, hasExisting: boolean, run: () => void) {
    if (!hasExisting) {
      run();
      return;
    }
    setPendingRegenerate(() => () => {
      setPendingRegenerate(null);
      run();
    });
    setRegenerateTitle(title);
    setRegenerateLabel(label);
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
      runBatchAnalysis={runExtract}
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
      {pendingRegenerate && (
        <OverwriteConfirm
          title={regenerateTitle}
          detail="Kết quả hiện tại sẽ bị thay bằng kết quả mới từ AI. Phần bạn đã sửa tay (nếu có) tại bước này sẽ mất."
          confirmLabel={regenerateLabel}
          onConfirm={pendingRegenerate}
          onCancel={() => setPendingRegenerate(null)}
        />
      )}
      <div className="relative z-10 w-full max-w-none space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <StepHeading step={`Bước ${step} / 5`} title={def.label} icon={def.icon} />
        {specificationError && <Notice tone="warn">{specificationError}</Notice>}
        {error && <Notice tone="danger">{error}</Notice>}
        {step === 1 && step1}
        {step === 2 && step2}
        {step === 3 && step3}
        {step === 4 && step4}
        {step === 5 && step5}
      </div>
    </div>
  );
}

function OverwriteConfirm({
  title,
  detail,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  detail: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <GhostButton onClick={onCancel}>Huỷ</GhostButton>
          <PrimaryButton onClick={onConfirm}>{confirmLabel}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}