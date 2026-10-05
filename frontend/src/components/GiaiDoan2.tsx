import { useEffect, useMemo, useState } from "react";
import type {
  InteractionType,
  Relation,
  Scenario,
  UmlClass,
  WorkflowState,
} from "../types/workflow";
import { STAGES } from "../stages";
import {
  extractProjectActorsUseCasesBatch,
  generateClasses,
  generateClassDiagram,
  generateProjectInteractionDiagramsBatch,
  generateProjectScenariosBatch,
  generateUseCaseDiagram,
  getProjectUmlState,
  listProjectSpecificationsForUml,
  saveProjectActorUseCasesBatch,
  updateUseCaseScenario,
  type ExtractedSuggestions,
  type ProjectSpecificationRecord,
  type ProjectUmlState,
  type UseCaseRecord,
} from "../services/umlService";
import {
  Card,
  DiagramPreview,
  EmptyState,
  FieldLabel,
  GhostButton,
  Notice,
  PrimaryButton,
  RemoveButton,
  SoftButton,
  StatusBadge,
  StepHeading,
  inputClass,
  singleLineClass,
  wrapClass,
} from "./ui/primitives";
import ProgressOverlay from "./ProgressOverlay";

interface Props {
  projectId?: number;
  state: WorkflowState;
  setState: (updater: (prev: WorkflowState) => WorkflowState) => void;
  step: number;
  onStepChange: (step: number) => void;
  /** Quay lại Giai đoạn 1, dùng cho thông báo "dự án chưa có đặc tả". */
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

const SCENARIO_PARTS: [keyof Scenario, string][] = [
  ["mainFlow", "Luồng chính"],
  ["altFlows", "Luồng phụ"],
  ["exceptions", "Ngoại lệ"],
];

/** Sau thời gian này mà dữ liệu chưa về thì bỏ chờ, không kẹt màn hình. */
const UML_LOAD_TIMEOUT_MS = 15000;

const RELATION_TYPES = [
  { value: "association", label: "Association" },
  { value: "include", label: "Include" },
  { value: "extend", label: "Extend" },
  { value: "generalization", label: "Generalization" },
];

function explainError(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Đã xảy ra lỗi không xác định.";
}

function imageExtension(url: string | null): "svg" | "png" {
  return url?.startsWith("data:image/png") || /\.png(?:$|[?#])/i.test(url ?? "")
    ? "png"
    : "svg";
}

/**
 * Luôn trả về mảng, kể cả khi backend trả `null` hoặc thiếu khoá.
 * Chặn lỗi "Cannot read properties of undefined (reading ...)" khi gọi
 * `.map()` / `.filter()` / `.length` trên dữ liệu chưa được kiểm chứng.
 */
function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Chuẩn hoá kịch bản từ backend (snake_case: main_flow / alt_flow /
 * exception_flow) sang kiểu `Scenario` (camelCase) mà phần UI sử dụng.
 */
function toScenario(record: UseCaseRecord): Scenario {
  return {
    mainFlow: asArray(record?.main_flow),
    altFlows: asArray(record?.alt_flow),
    exceptions: asArray(record?.exception_flow),
  };
}

function hydrateState(saved: ProjectUmlState, previous: WorkflowState): WorkflowState {
  // Mọi mảng đều đi qua asArray: response thiếu khoá hoặc trả null
  // không được phép làm sập cả màn hình Giai đoạn 2.
  const actors = asArray(saved?.actors);
  const useCases = asArray(saved?.use_cases);
  const relations = asArray(saved?.relations);
  const diagrams = asArray(saved?.diagrams);
  const classes = asArray(saved?.classes);
  const classRelations = asArray(saved?.class_relations);

  const actorById = new Map(actors.map((actor) => [actor.id, actor.name]));
  const useCaseById = new Map(useCases.map((useCase) => [useCase.id, useCase.name]));
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
    // toScenario đọc đúng main_flow/alt_flow/exception_flow của backend
    // và luôn trả về mảng, nên không còn lỗi "reading 'length'" ở đây.
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
      diagram.use_case_id === null ? [] : [{
        usecaseId: diagram.use_case_id,
        type: diagram.type as InteractionType,
        imageUrl: diagram.image_url,
        sourceCode: diagram.source_code,
      }],
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
  const [busy, setBusy] = useState(false);
  const [aiTaskLabel, setAiTaskLabel] = useState("");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionState>({ actors: [], useCases: [] });
  const [selectedActorTokens, setSelectedActorTokens] = useState<string[]>([]);
  const [selectedUseCaseTokens, setSelectedUseCaseTokens] = useState<string[]>([]);
  const [relationActors, setRelationActors] = useState<Record<string, string[]>>({});
  const [relationTypes, setRelationTypes] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [diagramType, setDiagramType] = useState<InteractionType>("sequence");
  /**
   * null = chưa biết (đang tải); [] = dự án chưa có đặc tả nào.
   * Giai đoạn 2 tự nạp từ database, không tin vào state của Giai đoạn 1.
   */
  const [specifications, setSpecifications] = useState<ProjectSpecificationRecord[] | null>(null);
  const [specificationError, setSpecificationError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  // Chặn lỗi "reading 'label'" nếu step vô tình nằm ngoài danh sách bước.
  const def = STAGES[2].steps[step - 1] ?? STAGES[2].steps[0];
  const scenarios = useMemo(
    () => state.usecases.filter((useCase) => state.scenarios[useCase.id]?.mainFlow.length),
    [state.scenarios, state.usecases],
  );
  const currentDiagramType = diagramType;
  const useCasesMissingScenario = state.usecases.filter(
    (useCase) => !state.scenarios[useCase.id]?.mainFlow.length,
  );
  const scenariosMissingDiagram = scenarios.filter(
    (useCase) => !state.interactions.some(
      (diagram) => diagram.usecaseId === useCase.id && diagram.type === currentDiagramType,
    ),
  );

  async function refreshSavedState(): Promise<void> {
    if (!projectId) return;
    const saved = await getProjectUmlState(projectId);
    setState((previous) => hydrateState(saved, previous));
  }

  useEffect(() => {
    let cancelled = false;
    if (!projectId) return () => { cancelled = true; };
    setLoadedProjectId(undefined);
    setError("");
    // Không để màn hình kẹt ở "Đang tải" vô hạn nếu request treo.
    const guard = setTimeout(() => {
      if (!cancelled) {
        setError("Không tải được dữ liệu UML trong thời gian chờ. Hãy thử lại.");
        setLoadedProjectId(projectId);
      }
    }, UML_LOAD_TIMEOUT_MS);
    // Bọc trong hàm async để bắt cả lỗi promise lẫn lỗi ném đồng bộ:
    // một lỗi ở đây tuyệt đối không được làm sập cả màn hình.
    const load = async () => {
      try {
        const saved = await getProjectUmlState(projectId);
        if (!cancelled) {
          setState((previous) => hydrateState(saved, previous));
          const lastInteractionDiagram = asArray(saved?.diagrams)
            .filter((item) => item.type === "sequence" || item.type === "collaboration")
            .at(-1);
          setDiagramType(
            lastInteractionDiagram?.type === "collaboration" ? "collaboration" : "sequence",
          );
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

  /**
   * Giai đoạn 2 tự nạp đặc tả từ database ngay khi mở, thay vì nhận qua props
   * từ Giai đoạn 1 (props có thể rỗng hoặc đã cũ sau khi đổi trang / reload).
   * Lỗi ở đây KHÔNG được làm sập màn hình: chỉ hiển thị thông báo.
   */
  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      setSpecifications(null);
      setSpecificationError("");
      return () => { cancelled = true; };
    }
    setSpecifications(null);
    setSpecificationError("");
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

  function updateScenario(useCaseId: number, field: keyof Scenario, lines: string[]) {
    setState((previous) => ({
      ...previous,
      scenarios: {
        ...previous.scenarios,
        [useCaseId]: {
          ...(previous.scenarios[useCaseId] ?? { mainFlow: [], altFlows: [], exceptions: [] }),
          [field]: lines,
        },
      },
    }));
  }

  const B1 = (
    <div className="space-y-6">
      {!projectId && <Notice tone="warn">Hãy mở một dự án để tải dữ liệu UML từ database.</Notice>}
      <Card
        tone="violet"
        title="Trích xuất tác nhân và use case"
        actions={
          <PrimaryButton
            disabled={!projectId || busy}
            onClick={() =>
              void runAction(async () => {
                const result = await extractProjectActorsUseCasesBatch(projectId!);
                const mapped = mapSuggestions(result);
                setSuggestions(mapped);
                setSelectedActorTokens(mapped.actors.map((item) => item.token));
                setSelectedUseCaseTokens(mapped.useCases.map((item) => item.token));
                const allActorNames = [
                  ...state.actors.map((item) => item.name),
                  ...mapped.actors.map((item) => item.name),
                ];
                setRelationActors(
                  Object.fromEntries(
                    mapped.useCases.map((item) => [item.token, [...new Set(allActorNames)]]),
                  ),
                );
                setRelationTypes(Object.fromEntries(mapped.useCases.map((item) => [item.token, "association"])));
              }, "Đang phân tích đặc tả và đề xuất tác nhân, use case...")
            }
          >
            {busy ? "Đang phân tích..." : "✨ Phân tích & đề xuất cho tất cả đặc tả"}
          </PrimaryButton>
        }
      >
        {specifications && specifications.length > 0 && (
          <div className="mb-5 rounded-xl border border-violet-100 bg-violet-50/60 p-4 text-sm text-slate-700">
            <p className="font-medium">
              Nguồn phân tích: {specifications.length} đặc tả trong database
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Gồm {specifications.filter((item) => item.type === "functional").length} đặc tả chức năng và{" "}
              {specifications.filter((item) => item.type === "non_functional").length} đặc tả phi chức năng.
            </p>
          </div>
        )}
        {state.actors.length > 0 || state.usecases.length > 0 ? (
          <div className="mb-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-medium">Dữ liệu đã lưu trong dự án</p>
            <p className="mt-1">{state.actors.length} tác nhân, {state.usecases.length} use case.</p>
            <ul className="mt-2 space-y-1">
              {state.actors.map((actor) => <li key={`actor-${actor.id}`} className={wrapClass}>Tác nhân: {actor.name}</li>)}
              {state.usecases.map((useCase) => <li key={`uc-${useCase.id}`} className={wrapClass}>Use case: {useCase.name}</li>)}
            </ul>
          </div>
        ) : null}
        {suggestions.actors.length === 0 && suggestions.useCases.length === 0 ? (
          <EmptyState title="Chưa có gợi ý" hint="Phân tích các đặc tả để nhận danh sách actor và use case." />
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="min-w-0">
              <FieldLabel hint={`${suggestions.actors.length} gợi ý`}>Tác nhân</FieldLabel>
              {suggestions.actors.length === 0 ? <p className="text-sm text-slate-500">Không có gợi ý tác nhân.</p> : (
                <ul className="space-y-2">
                  {suggestions.actors.map((actor) => (
                    <li key={actor.token} className="flex min-w-0 items-center gap-2">
                      <input
                        type="checkbox"
                        aria-label={`Chọn tác nhân ${actor.name}`}
                        checked={selectedActorTokens.includes(actor.token)}
                        onChange={() => setSelectedActorTokens((previous) =>
                          previous.includes(actor.token)
                            ? previous.filter((token) => token !== actor.token)
                            : [...previous, actor.token],
                        )}
                        className="h-4 w-4 accent-violet-600"
                      />
                      <input
                        value={actor.name}
                        aria-label="Tên tác nhân"
                        onChange={(event) => {
                          const oldName = actor.name;
                          const nextName = event.target.value;
                          setSuggestions((previous) => ({
                            ...previous,
                            actors: previous.actors.map((item) =>
                              item.token === actor.token ? { ...item, name: nextName } : item,
                            ),
                          }));
                          setRelationActors((previous) =>
                            Object.fromEntries(Object.entries(previous).map(([key, names]) => [
                              key,
                              names.map((name) => name === oldName ? nextName : name),
                            ])),
                          );
                        }}
                        className={singleLineClass}
                      />
                      <RemoveButton
                        label="Bỏ gợi ý tác nhân"
                        onClick={() => {
                          setSuggestions((previous) => ({
                            ...previous,
                            actors: previous.actors.filter((item) => item.token !== actor.token),
                          }));
                          setSelectedActorTokens((previous) => previous.filter((token) => token !== actor.token));
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="min-w-0">
              <FieldLabel hint={`${suggestions.useCases.length} gợi ý`}>Use case</FieldLabel>
              {suggestions.useCases.length === 0 ? <p className="text-sm text-slate-500">Không có gợi ý use case.</p> : (
                <ul className="space-y-3">
                  {suggestions.useCases.map((useCase) => (
                    <li key={useCase.token} className="min-w-0 rounded-xl border border-slate-200 p-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`Chọn use case ${useCase.name}`}
                          checked={selectedUseCaseTokens.includes(useCase.token)}
                          onChange={() => setSelectedUseCaseTokens((previous) =>
                            previous.includes(useCase.token)
                              ? previous.filter((token) => token !== useCase.token)
                              : [...previous, useCase.token],
                          )}
                          className="h-4 w-4 accent-violet-600"
                        />
                        <input
                          value={useCase.name}
                          aria-label="Tên use case gợi ý"
                          onChange={(event) => setSuggestions((previous) => ({
                            ...previous,
                            useCases: previous.useCases.map((item) =>
                              item.token === useCase.token ? { ...item, name: event.target.value } : item,
                            ),
                          }))}
                          className={singleLineClass}
                        />
                      </div>
                      <p className={`mt-2 pl-6 text-xs text-slate-500 ${wrapClass}`}>
                        Đặc tả #{useCase.specification_id}. {useCase.description}
                      </p>
                      {selectedUseCaseTokens.includes(useCase.token) && (
                        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                          <p className="text-xs font-semibold text-slate-700">Liên kết với tác nhân</p>
                          {[...new Set([
                            ...state.actors.map((item) => item.name),
                            ...suggestions.actors
                              .filter((item) => selectedActorTokens.includes(item.token))
                              .map((item) => item.name),
                          ])].map((actorName) => (
                            <label key={actorName} className={`flex min-w-0 items-center gap-2 text-sm text-slate-700 ${wrapClass}`}>
                              <input
                                type="checkbox"
                                checked={(relationActors[useCase.token] ?? []).includes(actorName)}
                                onChange={() => setRelationActors((previous) => {
                                  const current = previous[useCase.token] ?? [];
                                  return {
                                    ...previous,
                                    [useCase.token]: current.includes(actorName)
                                      ? current.filter((name) => name !== actorName)
                                      : [...current, actorName],
                                  };
                                })}
                                className="h-4 w-4 accent-violet-600"
                              />
                              {actorName}
                            </label>
                          ))}
                          <label className="block max-w-xs">
                            <FieldLabel>Loại quan hệ</FieldLabel>
                            <select
                              value={relationTypes[useCase.token] ?? "association"}
                              onChange={(event) => setRelationTypes((previous) => ({
                                ...previous,
                                [useCase.token]: event.target.value,
                              }))}
                              className={inputClass}
                            >
                              {RELATION_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                            </select>
                          </label>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {(suggestions.actors.length > 0 || suggestions.useCases.length > 0) && (
          <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
            <PrimaryButton
              disabled={busy || (selectedActorTokens.length === 0 && selectedUseCaseTokens.length === 0)}
              onClick={() =>
                void runAction(async () => {
                  const selectedActors = suggestions.actors
                    .filter((item) => selectedActorTokens.includes(item.token))
                    .map((item) => item.name.trim())
                    .filter(Boolean);
                  const selectedUseCases = suggestions.useCases
                    .filter((item) => selectedUseCaseTokens.includes(item.token) && item.name.trim());
                  const relationPairs = selectedUseCases.flatMap((item) =>
                    (relationActors[item.token] ?? []).map((actorName) => ({
                      specification_id: item.specification_id,
                      use_case_name: item.name.trim(),
                      actor_name: actorName,
                      relation_type: relationTypes[item.token] ?? "association",
                    })),
                  );
                  const actorNames = [...new Set([
                    ...selectedActors,
                    ...relationPairs.map((item) => item.actor_name),
                  ])];
                  await saveProjectActorUseCasesBatch(projectId!, {
                    actors: actorNames.map((name) => ({ name })),
                    use_cases: selectedUseCases.map((item) => ({
                      specification_id: item.specification_id,
                      name: item.name.trim(),
                    })),
                    relations: relationPairs,
                  });
                  await refreshSavedState();
                }, "Đang sinh biểu đồ Use Case...")
              }
            >
              {busy ? "Đang lưu..." : "Lưu danh sách"}
            </PrimaryButton>
          </div>
        )}
      </Card>
      <NavRow onBack={() => onStepChange(1)} nextLabel="Tiếp tục sang Bước 2" onNext={() => onStepChange(2)} />
    </div>
  );

  const B2 = (
    <div className="space-y-6">
      <Notice tone="warn">
        TODO: cần cấu hình PlantUML render service ở Backend bằng PLANTUML_RENDER_URL trước khi có thể lưu ảnh.
      </Notice>
      <Card
        tone="violet"
        title="Biểu đồ use case tổng quát"
        actions={
          <SoftButton
            disabled={busy || !projectId || state.actors.length === 0 || state.usecases.length === 0}
            onClick={() =>
              void runAction(async () => {
                try {
                  const diagram = await generateUseCaseDiagram(projectId!);
                  setState((previous) => ({
                    ...previous,
                    useCaseDiagramUrl: diagram.image_url,
                    useCaseDiagramCode: diagram.source_code,
                  }));
                } catch (reason) {
                  await refreshSavedState();
                  throw reason;
                }
              }, "Đang sinh kịch bản use case...")
            }
          >
            {busy ? "Đang sinh..." : "Sinh biểu đồ"}
          </SoftButton>
        }
      >
        <DiagramPreview
          imageUrl={state.useCaseDiagramUrl}
          emptyTitle="Chưa có ảnh biểu đồ Use Case"
          emptyHint='Bấm "Sinh biểu đồ" để tạo biểu đồ tổng cho project.'
          downloadName={`use-case-diagram.${imageExtension(state.useCaseDiagramUrl)}`}
        />
        {state.useCaseDiagramCode && <PlantUmlSource source={state.useCaseDiagramCode} />}
      </Card>
      <NavRow onBack={() => onStepChange(1)} nextLabel="Tiếp tục sang Bước 3" onNext={() => onStepChange(3)} />
    </div>
  );

  const B3 = (
    <div className="space-y-5">
      <Card
        tone="violet"
        title="Sinh kịch bản use case"
        actions={
          <PrimaryButton
            disabled={busy || !projectId || useCasesMissingScenario.length === 0}
            onClick={() =>
              void runAction(async () => {
                const result = await generateProjectScenariosBatch(projectId!);
                setState((previous) => ({
                  ...previous,
                  scenarios: {
                    ...previous.scenarios,
                    ...Object.fromEntries(result.results.map((item) => [
                      item.use_case_id,
                      {
                        mainFlow: item.main_flow,
                        altFlows: item.alt_flow,
                        exceptions: item.exception_flow,
                      },
                    ])),
                  },
                }));
                setExpandedIds(state.usecases.map((item) => item.id));
                await refreshSavedState();
              }, "Đang lưu kịch bản use case...")
            }
          >
            {busy ? "Đang sinh kịch bản..." : `Sinh kịch bản cho tất cả (${useCasesMissingScenario.length})`}
          </PrimaryButton>
        }
      >
        {state.usecases.length === 0 ? (
          <EmptyState title="Chưa có use case" hint="Quay lại Bước 1 để lưu danh sách use case." />
        ) : (
          <div className="space-y-3">
            {state.usecases.map((useCase) => {
              const scenario = state.scenarios[useCase.id];
              const open = expandedIds.includes(useCase.id);
              return (
                <section key={useCase.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className={`break-words text-sm font-semibold text-slate-900 ${wrapClass}`}>{useCase.name}</p>
                      <p className="mt-1 text-xs text-slate-500">Đặc tả ID {useCase.specificationId}</p>
                    </div>
                    {scenario?.mainFlow.length ? <StatusBadge tone="success">Đã có kịch bản</StatusBadge> : <StatusBadge tone="muted">Chưa sinh</StatusBadge>}
                    {scenario && (
                      <GhostButton onClick={() => setExpandedIds((previous) =>
                        open ? previous.filter((id) => id !== useCase.id) : [...previous, useCase.id],
                      )}>
                        {open ? "Thu gọn" : "Xem và sửa"}
                      </GhostButton>
                    )}
                  </div>
                  {scenario && open && (
                    <div className="space-y-5 border-t border-slate-100 bg-slate-50/70 p-5">
                      {SCENARIO_PARTS.map(([field, label]) => (
                        <div key={field} className="min-w-0">
                          <FieldLabel hint={`${scenario[field].length} dòng`}>{label}</FieldLabel>
                          <FlowListEditor
                            items={scenario[field]}
                            onChange={(lines) => updateScenario(useCase.id, field, lines)}
                            placeholder={`Nhập một bước thuộc ${label.toLowerCase()}`}
                            addLabel={`+ Thêm dòng ${label.toLowerCase()}`}
                          />
                        </div>
                      ))}
                      <div className="flex justify-end">
                        <PrimaryButton
                          disabled={busy || !scenario.mainFlow.some((item) => item.trim())}
                          onClick={() =>
                            void runAction(async () => {
                              const clean: Scenario = {
                                mainFlow: scenario.mainFlow.map((item) => item.trim()).filter(Boolean),
                                altFlows: scenario.altFlows.map((item) => item.trim()).filter(Boolean),
                                exceptions: scenario.exceptions.map((item) => item.trim()).filter(Boolean),
                              };
                              const saved = await updateUseCaseScenario(useCase.id, clean);
                              setState((previous) => ({
                                ...previous,
                                scenarios: { ...previous.scenarios, [useCase.id]: toScenario(saved) },
                              }));
                            }, "Đang sinh biểu đồ tương tác...")
                          }
                        >
                          Lưu kịch bản
                        </PrimaryButton>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GhostButton onClick={() => onStepChange(2)}>Quay lại</GhostButton>
        <PrimaryButton disabled={scenarios.length === 0} onClick={() => onStepChange(4)}>
          Tiếp tục sang Bước 4
        </PrimaryButton>
      </div>
    </div>
  );

  const B4 = (
    <div className="space-y-6">
      <Notice tone="warn">
        TODO: cần cấu hình PlantUML render service ở Backend bằng PLANTUML_RENDER_URL trước khi có thể hiển thị ảnh.
      </Notice>
      <Card
        tone="violet"
        title="Sinh biểu đồ tương tác"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {(["sequence", "collaboration"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDiagramType(type)}
                  className={`rounded-lg px-3 py-2 text-xs font-medium ${
                    currentDiagramType === type ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  {type === "sequence" ? "Sequence" : "Collaboration"}
                </button>
              ))}
            </div>
            <PrimaryButton
              disabled={busy || !projectId || scenariosMissingDiagram.length === 0}
              onClick={() =>
                void runAction(async () => {
                  try {
                    await generateProjectInteractionDiagramsBatch(projectId!, currentDiagramType);
                  } catch (reason) {
                    await refreshSavedState();
                    throw reason;
                  }
                  await refreshSavedState();
                }, "Đang suy luận lớp và sinh biểu đồ lớp...")
              }
            >
              {busy ? "Đang sinh biểu đồ..." : `Sinh biểu đồ cho tất cả (${scenariosMissingDiagram.length})`}
            </PrimaryButton>
          </div>
        }
      >
        {scenarios.length === 0 ? (
          <EmptyState title="Chưa có kịch bản" hint="Sinh kịch bản cho use case ở Bước 3 trước." />
        ) : (
          <div className="space-y-5">
            {scenarios.map((useCase) => {
              const diagram = state.interactions.find(
                (item) => item.usecaseId === useCase.id && item.type === currentDiagramType,
              );
              return (
                <section key={useCase.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className={`min-w-0 break-words font-semibold text-slate-900 ${wrapClass}`}>{useCase.name}</h3>
                    {diagram?.imageUrl
                      ? <StatusBadge tone="success">Đã render</StatusBadge>
                      : diagram ? <StatusBadge tone="warn">Đã lưu mã, chờ render</StatusBadge>
                        : <StatusBadge tone="muted">Chưa có biểu đồ</StatusBadge>}
                  </div>
                  <DiagramPreview
                    imageUrl={diagram?.imageUrl ?? null}
                    emptyTitle={diagram ? "Mã biểu đồ đã lưu, ảnh chưa sẵn sàng" : "Chưa có biểu đồ tương tác"}
                    emptyHint="Biểu đồ được lưu riêng cho từng use case."
                    downloadName={`${currentDiagramType}-${useCase.id}.${imageExtension(diagram?.imageUrl ?? null)}`}
                  />
                  {diagram?.sourceCode && <PlantUmlSource source={diagram.sourceCode} />}
                </section>
              );
            })}
          </div>
        )}
      </Card>
      <NavRow onBack={() => onStepChange(3)} nextLabel="Tiếp tục sang Bước 5" onNext={() => onStepChange(5)} />
    </div>
  );

  const B5 = (
    <div className="space-y-6">
      <Notice tone="warn">
        TODO: cần cấu hình PlantUML render service ở Backend bằng PLANTUML_RENDER_URL trước khi có thể lưu ảnh biểu đồ lớp.
      </Notice>
      <Card
        tone="violet"
        title="Mô hình lớp suy luận"
        actions={
          <SoftButton
            disabled={busy || !projectId || state.usecases.length === 0}
            onClick={() =>
              void runAction(async () => {
                try {
                  const classes = await generateClasses(projectId!);
                  setState((previous) => ({
                    ...previous,
                    umlClasses: classes.map((item) => ({
                      id: item.id,
                      name: item.name,
                      attributes: item.attributes,
                      methods: item.methods,
                    })),
                  }));
                  const diagram = await generateClassDiagram(projectId!);
                  setState((previous) => ({
                    ...previous,
                    classDiagramUrl: diagram.image_url,
                    classDiagramCode: diagram.source_code,
                  }));
                } catch (reason) {
                  await refreshSavedState();
                  throw reason;
                }
              })
            }
          >
            {busy ? "Đang suy luận và sinh biểu đồ..." : "Sinh biểu đồ lớp"}
          </SoftButton>
        }
      >
        {state.umlClasses.length === 0 ? (
          <EmptyState icon="◫" title="Chưa có lớp trong database" hint="Sinh kịch bản use case trước khi suy luận mô hình lớp." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr><th className="px-4 py-3">Lớp</th><th className="px-4 py-3">Thuộc tính</th><th className="px-4 py-3">Phương thức</th></tr>
              </thead>
              <tbody>
                {state.umlClasses.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 align-top">
                    <th className={`max-w-48 px-4 py-3 font-semibold text-slate-800 ${wrapClass}`}>{item.name}</th>
                    <td className="min-w-0 px-4 py-3">
                      <ul className="space-y-1">{item.attributes.map((value, index) => <li key={`${value}-${index}`} className={`text-slate-600 ${wrapClass}`}>{value}</li>)}</ul>
                    </td>
                    <td className="min-w-0 px-4 py-3">
                      <ul className="space-y-1">{item.methods.map((value, index) => <li key={`${value}-${index}`} className={`text-slate-600 ${wrapClass}`}>{value}</li>)}</ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="Biểu đồ lớp" tone="emerald">
        <DiagramPreview
          imageUrl={state.classDiagramUrl}
          emptyTitle="Chưa có ảnh biểu đồ lớp"
          emptyHint="Cấu hình PlantUML render service rồi sinh biểu đồ lớp."
          downloadName={`class-diagram.${imageExtension(state.classDiagramUrl)}`}
        />
        {state.classDiagramCode && <PlantUmlSource source={state.classDiagramCode} />}
      </Card>
      <div className="flex justify-start"><GhostButton onClick={() => onStepChange(4)}>Quay lại Bước 4</GhostButton></div>
    </div>
  );

  if (projectId && loadedProjectId !== projectId) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-slate-500">Đang tải dữ liệu UML từ database...</div>;
  }

  /**
   * Guard rõ ràng: dự án chưa có đặc tả thì không thể trích xuất tác nhân/UC.
   * Trả về sớm một màn hình hướng dẫn kèm nút quay lại, TUYỆT ĐỐI không để
   * `.map()` trên mảng rỗng làm trắng trang.
   */
  if (specifications && specifications.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card tone="amber" title="Project chưa có đặc tả">
          <p className="text-sm text-slate-700">
            Dự án này chưa có đặc tả nào trong database, nên chưa thể chuyển sang mô hình hóa UML.
            Vui lòng hoàn thành <strong>Giai đoạn 1 — Thu thập &amp; Đặc tả</strong> trước.
          </p>
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>Vào Giai đoạn 1, nhập và phân tích yêu cầu.</li>
            <li>Kiểm duyệt và xác nhận user story.</li>
            <li>Sinh đặc tả chức năng và phi chức năng.</li>
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
      <div className="relative z-10 mx-auto max-w-5xl space-y-6 px-4 py-8">
        <StepHeading step={`Bước ${step} / 5`} title={def.label} icon={def.icon} />
        {specificationError && <Notice tone="warn">{specificationError}</Notice>}
        {error && <Notice tone="danger">{error}</Notice>}
        {step === 1 && B1}
        {step === 2 && B2}
        {step === 3 && B3}
        {step === 4 && B4}
        {step === 5 && B5}
      </div>
    </div>
  );
}

function NavRow({
  onBack,
  onNext,
  nextLabel,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <GhostButton onClick={onBack}>Quay lại</GhostButton>
      <PrimaryButton onClick={onNext}>{nextLabel}</PrimaryButton>
    </div>
  );
}

function PlantUmlSource({ source }: { source: string }) {
  return (
    <details className="mt-4 min-w-0 rounded-xl border border-slate-200 bg-slate-50">
      <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-600">Mã PlantUML đã lưu</summary>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words border-t border-slate-200 p-4 font-mono text-xs text-slate-700 [overflow-wrap:anywhere]">
        {source}
      </pre>
    </details>
  );
}

function FlowListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  const rows = items.length > 0 ? items : [""];
  return (
    <div className="space-y-2">
      {rows.map((value, index) => (
        <div key={index} className="flex min-w-0 items-start gap-2">
          <textarea
            rows={2}
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(rows.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
            className={`${inputClass} min-h-16 resize-y whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}
          />
          {rows.length > 1 && (
            <RemoveButton label="Xóa bước kịch bản" onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))} />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange(rows.length === 1 && !rows[0] ? ["", ""] : [...rows, ""])}
        className="inline-flex h-9 items-center gap-1 rounded-lg px-1 text-sm font-medium text-violet-600 transition hover:text-violet-800"
      >
        {addLabel}
      </button>
    </div>
  );
}
