import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import EditorModule from "react-simple-code-editor";
import type { ExportFormat, WorkflowState } from "../types/workflow";
import { STAGES } from "../stages";
import { attachDiagramToDoc, renderDiagram } from "../services/aiService";
import {
  generateClassDiagram,
  listProjectDiagrams,
  updateDiagram,
} from "../services/umlService";
import {
  Card,
  DiagramPreview,
  EmptyState,
  FieldLabel,
  GhostButton,
  Notice,
  PlaceholderNote,
  PrimaryButton,
  RemoveButton,
  SegmentedControl,
  SoftButton,
  StatusBadge,
  StepHeading,
  StringListEditor,
  singleLineClass,
  wrapClass,
} from "./common/ui/primitives";
import ProgressOverlay from "./common/ProgressOverlay";

/**
 * Một số cấu hình Vite có thể trả về module dạng { default: Component }.
 * Chuẩn hóa module để React nhận được component hợp lệ.
 */
const CodeEditor = (
  (
    EditorModule as unknown as {
      default?: ComponentType<any>;
    }
  ).default ?? EditorModule
) as ComponentType<any>;

let nextRelationId = 200;
let nextClassId = 200;

interface Props {
  projectId: number;
  state: WorkflowState;
  setState: (updater: (prev: WorkflowState) => WorkflowState) => void;
  step: number;
  onStepChange: (step: number) => void;
}

const RELATION_TYPES = [
  "association",
  "include",
  "extend",
  "generalization",
];

/**
 * GIAI ĐOẠN 3: Tùy chỉnh và xuất kết quả (4 bước).
 *
 * - Tải biểu đồ lớp đã lưu từ backend.
 * - Cho phép chỉnh sửa dữ liệu và mã PlantUML.
 * - Render ảnh và cập nhật biểu đồ hiện có.
 * - Xuất ảnh và chèn biểu đồ vào tài liệu.
 */
export default function GiaiDoan3({
  projectId,
  state,
  setState,
  step,
  onStepChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [aiTaskLabel, setAiTaskLabel] = useState("");
  const [savedDiagramId, setSavedDiagramId] = useState<number | null>(null);

  const def = STAGES[3].steps[step - 1];

  // Tải biểu đồ lớp đã lưu khi mở hoặc chuyển dự án.
  useEffect(() => {
    let cancelled = false;

    async function loadSavedDiagram() {
      try {
        const diagrams = await listProjectDiagrams(projectId);

        if (cancelled) return;

        const saved = diagrams
          .filter((diagram) => diagram.type === "class")
          .sort((a, b) => b.id - a.id)[0];

        if (saved) {
          setSavedDiagramId(saved.id);

          setState((prev) => ({
            ...prev,
            diagramCode: saved.source_code,
            previewImageUrl: saved.image_url ?? prev.previewImageUrl,
          }));
        } else {
          setSavedDiagramId(null);
        }
      } catch (error) {
        console.error("Không tải được biểu đồ đã lưu:", error);
      }
    }

    void loadSavedDiagram();

    return () => {
      cancelled = true;
    };
  }, [projectId, setState]);

  /** Dựng mã PlantUML từ dữ liệu thành phần ở Bước 1. */
  const buildCode = () => {
    const lines = ["@startuml", "left to right direction"];

    state.actors
      .filter((actor) => actor.name.trim())
      .forEach((actor) => {
        lines.push(
          `actor "${actor.name}" as ${actor.name.replace(/\s+/g, "_")}`,
        );
      });

    state.usecases
      .filter((usecase) => usecase.name.trim())
      .forEach((usecase) => {
        lines.push(`usecase "${usecase.name}" as UC_${usecase.id}`);
      });

    state.relations
      .filter((relation) => relation.from.trim() && relation.to.trim())
      .forEach((relation) => {
        lines.push(
          `${relation.from.replace(/\s+/g, "_")} --> ${relation.to.replace(/\s+/g, "_")} : ${relation.type}`,
        );
      });

    state.umlClasses
      .filter((umlClass) => umlClass.name.trim())
      .forEach((umlClass) => {
        lines.push(`class ${umlClass.name} {`);

        umlClass.attributes.forEach((attribute) => {
          lines.push(`  ${attribute}`);
        });

        umlClass.methods.forEach((method) => {
          lines.push(`  ${method}`);
        });

        lines.push("}");
      });

    lines.push("@enduml");

    return lines.join("\n");
  };

  /* ---------------- Bước 1: Chỉnh sửa thành phần ---------------- */
  const B1 = (
    <div className="space-y-6">
      {/* Tác nhân */}
      <Card tone="violet" title="Tác nhân">
        {state.actors.length === 0 ? (
          <EmptyState
            icon="☺"
            title="Chưa có tác nhân nào"
            hint="Quay lại Giai đoạn 2 Bước 1 để trích xuất tác nhân, hoặc thêm ở đây."
          />
        ) : (
          <StringListEditor
            items={state.actors.map((actor) => actor.name)}
            onChange={(names) =>
              setState((prev) => ({
                ...prev,
                actors: names.map((name, index) => ({
                  id: prev.actors[index]?.id ?? index + 1,
                  name,
                })),
              }))
            }
            placeholder="VD: Khách hàng"
            addLabel="+ Thêm tác nhân"
          />
        )}
      </Card>

      {/* Use case */}
      <Card tone="violet" title="Use case">
        {state.usecases.length === 0 ? (
          <EmptyState
            icon="◉"
            title="Chưa có use case nào"
            hint="Quay lại Giai đoạn 2 Bước 1 để trích xuất danh sách use case."
          />
        ) : (
          <ul className="space-y-2">
            {state.usecases.map((uc, index) => (
              <li
                key={`${uc.id}-${index}`}
                className="flex items-center gap-2"
              >
                <input
                  value={uc.name}
                  aria-label="Tên use case"
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      usecases: prev.usecases.map((usecase) =>
                        usecase.id === uc.id
                          ? { ...usecase, name: event.target.value }
                          : usecase,
                      ),
                    }))
                  }
                  className={singleLineClass}
                />

                <RemoveButton
                  label="Xoá use case"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      usecases: prev.usecases.filter(
                        (usecase) => usecase.id !== uc.id,
                      ),
                    }))
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Lớp */}
      <Card tone="violet" title="Lớp">
        {state.umlClasses.length === 0 ? (
          <EmptyState
            icon="◫"
            title="Chưa có lớp nào"
            hint="Quay lại Giai đoạn 2 Bước 5 để suy luận lớp, hoặc thêm lớp ở đây."
          />
        ) : (
          <ul className="space-y-4">
            {state.umlClasses.map((umlClass, index) => (
              <li
                key={`${umlClass.id}-${index}`}
                className="overflow-hidden rounded-xl border-slate-200 bg-slate-50 shadow-sm"
              >
                <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
                  <input
                    value={umlClass.name}
                    aria-label="Tên lớp"
                    onChange={(event) =>
                      setState((prev) => ({
                        ...prev,
                        umlClasses: prev.umlClasses.map((item) =>
                          item.id === umlClass.id
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    placeholder="Tên lớp"
                    className={singleLineClass}
                  />

                  <RemoveButton
                    label={`Xoá lớp ${umlClass.name || ""}`}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        umlClasses: prev.umlClasses.filter(
                          (item) => item.id !== umlClass.id,
                        ),
                      }))
                    }
                  />
                </div>

                <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
                  <div className="min-w-0 border-b border-slate-200 p-4 sm:border-b-0 sm:border-r">
                    <FieldLabel hint={`${umlClass.attributes.length} mục`}>
                      Thuộc tính
                    </FieldLabel>

                    <StringListEditor
                      items={umlClass.attributes}
                      onChange={(attributes) =>
                        setState((prev) => ({
                          ...prev,
                          umlClasses: prev.umlClasses.map((item) =>
                            item.id === umlClass.id
                              ? { ...item, attributes }
                              : item,
                          ),
                        }))
                      }
                      addLabel="+ Thêm thuộc tính"
                    />
                  </div>

                  <div className="min-w-0 p-4">
                    <FieldLabel hint={`${umlClass.methods.length} mục`}>
                      Phương thức
                    </FieldLabel>

                    <StringListEditor
                      items={umlClass.methods}
                      onChange={(methods) =>
                        setState((prev) => ({
                          ...prev,
                          umlClasses: prev.umlClasses.map((item) =>
                            item.id === umlClass.id
                              ? { ...item, methods }
                              : item,
                          ),
                        }))
                      }
                      addLabel="+ Thêm phương thức"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() =>
            setState((prev) => ({
              ...prev,
              umlClasses: [
                ...prev.umlClasses,
                {
                  id: nextClassId++,
                  name: "",
                  attributes: [],
                  methods: [],
                },
              ],
            }))
          }
          className="mt-4 inline-flex h-9 items-center rounded-lg px-1 text-sm font-medium text-violet-600 transition hover:text-violet-800"
        >
          + Thêm lớp
        </button>
      </Card>

      {/* Quan hệ */}
      <Card tone="violet" title="Quan hệ">
        {state.relations.length === 0 ? (
          <EmptyState
            icon="⇄"
            title="Chưa có quan hệ nào"
            hint="Thêm quan hệ giữa tác nhân, use case hoặc lớp ở đây."
          />
        ) : (
          <ul className="space-y-2">
            {state.relations.map((relation, index) => (
              <li
                key={`${relation.id}-${index}`}
                className="flex flex-wrap items-center gap-2 sm:flex-nowrap"
              >
                <input
                  value={relation.from}
                  aria-label="Quan hệ từ"
                  placeholder="Từ"
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      relations: prev.relations.map((item) =>
                        item.id === relation.id
                          ? { ...item, from: event.target.value }
                          : item,
                      ),
                    }))
                  }
                  className={`${singleLineClass} flex-1 basis-40`}
                />

                <select
                  value={relation.type}
                  aria-label="Loại quan hệ"
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      relations: prev.relations.map((item) =>
                        item.id === relation.id
                          ? { ...item, type: event.target.value }
                          : item,
                      ),
                    }))
                  }
                  className={`${singleLineClass} w-full shrink-0 sm:w-40`}
                >
                  {RELATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>

                <input
                  value={relation.to}
                  aria-label="Quan hệ đến"
                  placeholder="Đến"
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      relations: prev.relations.map((item) =>
                        item.id === relation.id
                          ? { ...item, to: event.target.value }
                          : item,
                      ),
                    }))
                  }
                  className={`${singleLineClass} flex-1 basis-40`}
                />

                <RemoveButton
                  label="Xoá quan hệ"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      relations: prev.relations.filter(
                        (item) => item.id !== relation.id,
                      ),
                    }))
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() =>
            setState((prev) => ({
              ...prev,
              relations: [
                ...prev.relations,
                {
                  id: nextRelationId++,
                  from: "",
                  to: "",
                  type: "association",
                },
              ],
            }))
          }
          className="mt-4 inline-flex h-9 items-center rounded-lg px-1 text-sm font-medium text-violet-600 transition hover:text-violet-800"
        >
          + Thêm quan hệ
        </button>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <PrimaryButton onClick={() => onStepChange(2)}>
          Tiếp tục sinh mã →
        </PrimaryButton>
      </div>
    </div>
  );

  /* ---------------- Bước 2: Chỉnh sửa mã PlantUML ---------------- */
  const B2 = (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <p className={`text-sm font-semibold text-slate-900 ${wrapClass}`}>
              Mã mô tả biểu đồ (PlantUML)
            </p>

            <p className={`mt-0.5 text-xs text-slate-500 ${wrapClass}`}>
              Sửa trực tiếp, hoặc sinh lại từ dữ liệu ở Bước 1.
            </p>
          </div>

          <SoftButton
            onClick={() =>
              setState((prev) => ({
                ...prev,
                diagramCode: buildCode(),
              }))
            }
          >
            Sinh lại mã từ dữ liệu trên
          </SoftButton>
        </div>

        <div className="max-h-96 overflow-auto bg-slate-900 p-4">
          <CodeEditor
            value={state.diagramCode}
            onValueChange={(code: string) =>
              setState((prev) => ({
                ...prev,
                diagramCode: code,
              }))
            }
            highlight={(code: string) => code}
            padding={0}
            style={{
              fontFamily: '"Fira Code", monospace',
              fontSize: 13,
              color: "#e2e8f0",
              minHeight: "220px",
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <GhostButton onClick={() => onStepChange(1)}>
          ← Quay lại sửa thành phần
        </GhostButton>

        <PrimaryButton onClick={() => onStepChange(3)}>
          Tiếp tục xem trước →
        </PrimaryButton>
      </div>
    </div>
  );

  /* ---------------- Bước 3: Render và xem trước ---------------- */
  const B3 = (
    <div className="space-y-6">
      <Card
        tone="violet"
        title="Xem trước và hiển thị"
        actions={
          <SoftButton
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setAiTaskLabel("Đang render và lưu biểu đồ...");

              try {
                // Render mã PlantUML hiện tại.
                const url = await renderDiagram(state.diagramCode);

                // Tạo bản ghi nếu chưa có; các lần sau cập nhật bản ghi đó.
                let diagramId = savedDiagramId;

                if (diagramId === null) {
                  const created = await generateClassDiagram(projectId);
                  diagramId = created.id;
                  setSavedDiagramId(created.id);
                }

                const saved = await updateDiagram(
                  diagramId,
                  state.diagramCode,
                );

                setState((prev) => ({
                  ...prev,
                  diagramCode: saved.source_code,
                  previewImageUrl: saved.image_url ?? url,
                }));
              } catch (error) {
                console.error(
                  "Không thể render hoặc lưu biểu đồ:",
                  error,
                );

                window.alert(
                  "Không thể lưu biểu đồ. Hãy kiểm tra backend và thử lại.",
                );
              } finally {
                setBusy(false);
                setAiTaskLabel("");
              }
            }}
          >
            {busy ? "Đang render..." : "Render và xem trước"}
          </SoftButton>
        }
      >
        <DiagramPreview
          imageUrl={state.previewImageUrl}
          emptyTitle="Chưa có ảnh xem trước"
          emptyHint='Bấm nút "Render và xem trước" để tạo ảnh từ mã hiện tại.'
          downloadName="diagram-preview.svg"
        />

        <PlaceholderNote endpoint="POST /diagram/render" />
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <GhostButton onClick={() => onStepChange(1)}>
            ← Quay lại sửa thành phần
          </GhostButton>

          <GhostButton onClick={() => onStepChange(2)}>
            ← Quay lại sửa mã
          </GhostButton>
        </div>

        <PrimaryButton
          disabled={!state.previewImageUrl}
          onClick={() => onStepChange(4)}
        >
          Ưng ý, tiếp tục xuất →
        </PrimaryButton>
      </div>
    </div>
  );

  /* ---------------- Bước 4: Xuất kết quả ---------------- */
  const B4 = (
    <div className="space-y-6">
      <Card tone="violet" title="Định dạng xuất">
        <SegmentedControl<ExportFormat>
          value={state.exportFormat}
          onChange={(format) =>
            setState((prev) => ({
              ...prev,
              exportFormat: format,
            }))
          }
          options={[
            { value: "png", label: "PNG" },
            { value: "svg", label: "SVG" },
          ]}
        />
      </Card>

      {state.previewImageUrl ? (
        <DiagramPreview
          imageUrl={state.previewImageUrl}
          emptyTitle="Chưa có ảnh biểu đồ"
          downloadName={`diagram.${state.exportFormat}`}
        />
      ) : (
        <Notice tone="warn">
          Chưa có ảnh biểu đồ để xuất. Hãy quay lại Bước 3 để render trước khi
          xuất.
        </Notice>
      )}

      <Card
        tone="emerald"
        title="Xuất kết quả"
        actions={
          state.embeddedDiagrams.length > 0 ? (
            <StatusBadge tone="success">
              Đã chèn {state.embeddedDiagrams.length} biểu đồ
            </StatusBadge>
          ) : undefined
        }
      >
        <div className="flex flex-wrap gap-3">
          {state.previewImageUrl && (
            <a
              href={state.previewImageUrl}
              download={`diagram.${state.exportFormat}`}
              className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-violet-600 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 hover:shadow-md"
            >
              ⬇ Xuất file ảnh (.{state.exportFormat})
            </a>
          )}

          <SoftButton
            disabled={!state.previewImageUrl || busy}
            onClick={async () => {
              if (!state.previewImageUrl) return;

              setBusy(true);
              setAiTaskLabel("Đang chèn biểu đồ vào tài liệu...");

              try {
                const name = `Biểu đồ ${new Date().toLocaleString("vi-VN")}`;

                await attachDiagramToDoc(name, state.previewImageUrl);

                setState((prev) => ({
                  ...prev,
                  embeddedDiagrams: [
                    ...prev.embeddedDiagrams,
                    {
                      name,
                      imageUrl: state.previewImageUrl!,
                    },
                  ],
                }));
              } catch (error) {
                console.error(
                  "Không thể chèn biểu đồ vào tài liệu:",
                  error,
                );

                window.alert(
                  "Không thể chèn biểu đồ vào tài liệu. Hãy thử lại.",
                );
              } finally {
                setBusy(false);
                setAiTaskLabel("");
              }
            }}
          >
            Chèn vào tài liệu đặc tả hệ thống
          </SoftButton>
        </div>

        {!state.previewImageUrl && (
          <p className={`mt-3 text-xs text-slate-500 ${wrapClass}`}>
            Nút xuất sẽ khả dụng sau khi có ảnh ở Bước 3.
          </p>
        )}

        <PlaceholderNote endpoint="POST /diagram/export và POST /specs/attach-diagram" />
      </Card>

      <div className="flex flex-wrap justify-between gap-3">
        <GhostButton onClick={() => onStepChange(3)}>
          ← Quay lại sửa mã
        </GhostButton>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {aiTaskLabel && <ProgressOverlay label={aiTaskLabel} />}

      <div className="relative z-10 mx-auto max-w-5xl space-y-6 px-4 py-8">
        <StepHeading
          step={`Bước ${step} / 4`}
          title={def.label}
          icon={def.icon}
        />

        {step === 1 && B1}
        {step === 2 && B2}
        {step === 3 && B3}
        {step === 4 && B4}
      </div>
    </div>
  );
}