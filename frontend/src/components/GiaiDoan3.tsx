import { useState } from "react";
import Editor from "react-simple-code-editor";
import type { ExportFormat, WorkflowState } from "../types/workflow";
import { STAGES } from "../stages";
import { attachDiagramToDoc, renderDiagram } from "../services/aiService";
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
} from "./ui/primitives";
import ProgressOverlay from "./ProgressOverlay";

let nextRelationId = 200;
let nextClassId = 200;

interface Props {
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
 * Đầu vào là bộ thành phần biểu đồ từ Giai đoạn 2. Đầu ra là file ảnh biểu đồ
 * và bản cập nhật tài liệu đặc tả đã tạo ở Giai đoạn 1 Bước 5.
 */
export default function GiaiDoan3({
  state,
  setState,
  step,
  onStepChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [aiTaskLabel, setAiTaskLabel] = useState("");
  const def = STAGES[3].steps[step - 1];

  /** Dựng mã PlantUML từ dữ liệu thành phần ở Bước 1. */
  const buildCode = () => {
    const lines = ["@startuml", "left to right direction"];

    state.actors
      .filter((a) => a.name.trim())
      .forEach((a) =>
        lines.push(`actor "${a.name}" as ${a.name.replace(/\s+/g, "_")}`),
      );
    state.usecases
      .filter((u) => u.name.trim())
      .forEach((u) => lines.push(`usecase "${u.name}" as UC_${u.id}`));
    state.relations
      .filter((r) => r.from.trim() && r.to.trim())
      .forEach((r) =>
        lines.push(
          `${r.from.replace(/\s+/g, "_")} --> ${r.to.replace(/\s+/g, "_")} : ${r.type}`,
        ),
      );

    state.umlClasses
      .filter((c) => c.name.trim())
      .forEach((c) => {
        lines.push(`class ${c.name} {`);
        c.attributes.forEach((a) => lines.push(`  ${a}`));
        c.methods.forEach((m) => lines.push(`  ${m}`));
        lines.push("}");
      });

    lines.push("@enduml");
    return lines.join("\n");
  };

  /* ---------------- Bước 1 ---------------- */
  const B1 = (
    <div className="space-y-6">
      {/* Tác nhân */}
      <Card
        tone="violet"
        title="Tác nhân"
      >
        {state.actors.length === 0 ? (
          <EmptyState
            icon="☺"
            title="Chưa có tác nhân nào"
            hint="Quay lại Giai đoạn 2 Bước 1 để trích xuất tác nhân, hoặc thêm ở đây."
          />
        ) : (
          <StringListEditor
            items={state.actors.map((a) => a.name)}
            onChange={(names) =>
              setState((p) => ({
                ...p,
                actors: names.map((name, i) => ({
                  id: p.actors[i]?.id ?? i + 1,
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
      <Card
        tone="violet"
        title="Use case"
      >
        {state.usecases.length === 0 ? (
          <EmptyState
            icon="◉"
            title="Chưa có use case nào"
            hint="Quay lại Giai đoạn 2 Bước 1 để trích xuất danh sách use case."
          />
        ) : (
          <ul className="space-y-2">
            {state.usecases.map((uc) => (
              <li key={uc.id} className="flex items-center gap-2">
                <input
                  value={uc.name}
                  aria-label="Tên use case"
                  onChange={(e) =>
                    setState((p) => ({
                      ...p,
                      usecases: p.usecases.map((u) =>
                        u.id === uc.id ? { ...u, name: e.target.value } : u,
                      ),
                    }))
                  }
                  className={singleLineClass}
                />
                <RemoveButton
                  label="Xoá use case"
                  onClick={() =>
                    setState((p) => ({
                      ...p,
                      usecases: p.usecases.filter((u) => u.id !== uc.id),
                    }))
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Lớp */}
      <Card
        tone="violet"
        title="Lớp"
      >
        {state.umlClasses.length === 0 ? (
          <EmptyState
            icon="◫"
            title="Chưa có lớp nào"
            hint="Quay lại Giai đoạn 2 Bước 5 để suy luận lớp, hoặc thêm lớp ở đây."
          />
        ) : (
          <ul className="space-y-4">
            {state.umlClasses.map((c) => (
              <li
                key={c.id}
                className="overflow-hidden rounded-xl border-slate-200 bg-slate-50 shadow-sm"
              >
                <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
                  <input
                    value={c.name}
                    aria-label="Tên lớp"
                    onChange={(e) =>
                      setState((p) => ({
                        ...p,
                        umlClasses: p.umlClasses.map((x) =>
                          x.id === c.id ? { ...x, name: e.target.value } : x,
                        ),
                      }))
                    }
                    placeholder="Tên lớp"
                    className={singleLineClass}
                  />
                  <RemoveButton
                    label={`Xoá lớp ${c.name || ""}`}
                    onClick={() =>
                      setState((p) => ({
                        ...p,
                        umlClasses: p.umlClasses.filter((x) => x.id !== c.id),
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
                  <div className="min-w-0 border-b border-slate-200 p-4 sm:border-b-0 sm:border-r">
                    <FieldLabel hint={`${c.attributes.length} mục`}>
                      Thuộc tính
                    </FieldLabel>
                    <StringListEditor
                      items={c.attributes}
                      onChange={(attrs) =>
                        setState((p) => ({
                          ...p,
                          umlClasses: p.umlClasses.map((x) =>
                            x.id === c.id ? { ...x, attributes: attrs } : x,
                          ),
                        }))
                      }
                      addLabel="+ Thêm thuộc tính"
                    />
                  </div>
                  <div className="min-w-0 p-4">
                    <FieldLabel hint={`${c.methods.length} mục`}>
                      Phương thức
                    </FieldLabel>
                    <StringListEditor
                      items={c.methods}
                      onChange={(methods) =>
                        setState((p) => ({
                          ...p,
                          umlClasses: p.umlClasses.map((x) =>
                            x.id === c.id ? { ...x, methods } : x,
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
            setState((p) => ({
              ...p,
              umlClasses: [
                ...p.umlClasses,
                { id: nextClassId++, name: "", attributes: [], methods: [] },
              ],
            }))
          }
          className="mt-4 inline-flex h-9 items-center rounded-lg px-1 text-sm font-medium text-violet-600 transition hover:text-violet-800"
        >
          + Thêm lớp
        </button>
      </Card>

      {/* Quan hệ */}
      <Card
        tone="violet"
        title="Quan hệ"
      >
        {state.relations.length === 0 ? (
          <EmptyState
            icon="⇄"
            title="Chưa có quan hệ nào"
            hint="Thêm quan hệ giữa tác nhân, use case hoặc lớp ở đây."
          />
        ) : (
          <ul className="space-y-2">
            {state.relations.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2 sm:flex-nowrap"
              >
                <input
                  value={r.from}
                  aria-label="Quan hệ từ"
                  placeholder="Từ"
                  onChange={(e) =>
                    setState((p) => ({
                      ...p,
                      relations: p.relations.map((x) =>
                        x.id === r.id ? { ...x, from: e.target.value } : x,
                      ),
                    }))
                  }
                  className={`${singleLineClass} flex-1 basis-40`}
                />
                <select
                  value={r.type}
                  aria-label="Loại quan hệ"
                  onChange={(e) =>
                    setState((p) => ({
                      ...p,
                      relations: p.relations.map((x) =>
                        x.id === r.id ? { ...x, type: e.target.value } : x,
                      ),
                    }))
                  }
                  className={`${singleLineClass} w-full shrink-0 sm:w-40`}
                >
                  {RELATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  value={r.to}
                  aria-label="Quan hệ đến"
                  placeholder="Đến"
                  onChange={(e) =>
                    setState((p) => ({
                      ...p,
                      relations: p.relations.map((x) =>
                        x.id === r.id ? { ...x, to: e.target.value } : x,
                      ),
                    }))
                  }
                  className={`${singleLineClass} flex-1 basis-40`}
                />
                <RemoveButton
                  label="Xoá quan hệ"
                  onClick={() =>
                    setState((p) => ({
                      ...p,
                      relations: p.relations.filter((x) => x.id !== r.id),
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
            setState((p) => ({
              ...p,
              relations: [
                ...p.relations,
                { id: nextRelationId++, from: "", to: "", type: "association" },
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

  /* ---------------- Bước 2 ---------------- */
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
            onClick={() => setState((p) => ({ ...p, diagramCode: buildCode() }))}
          >
            Sinh lại mã từ dữ liệu trên
          </SoftButton>
        </div>
        <div className="max-h-96 overflow-auto bg-slate-900 p-4">
          <Editor
            value={state.diagramCode}
            onValueChange={(code) => setState((p) => ({ ...p, diagramCode: code }))}
            highlight={(c) => c}
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

  /* ---------------- Bước 3 ---------------- */
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
              setAiTaskLabel("Đang tạo bản xem trước biểu đồ...");
              try {
                const url = await renderDiagram(state.diagramCode);
                setState((p) => ({ ...p, previewImageUrl: url }));
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
          downloadName={`diagram-preview.svg`}
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
          Ứng ý, tiếp tục xuất →
        </PrimaryButton>
      </div>
    </div>
  );

  /* ---------------- Bước 4 ---------------- */
  const B4 = (
    <div className="space-y-6">
      <Card
        tone="violet"
        title="Định dạng xuất"
      >
        <SegmentedControl<ExportFormat>
          value={state.exportFormat}
          onChange={(f) => setState((p) => ({ ...p, exportFormat: f }))}
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
          Chưa có ảnh biểu đồ để xuất. Hãy quay lại Bước 3 để render trước khi xuất.
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
                setState((p) => ({
                  ...p,
                  embeddedDiagrams: [
                    ...p.embeddedDiagrams,
                    { name, imageUrl: state.previewImageUrl! },
                  ],
                }));
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
        <GhostButton onClick={() => onStepChange(3)}>← Quay lại sửa mã</GhostButton>
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
