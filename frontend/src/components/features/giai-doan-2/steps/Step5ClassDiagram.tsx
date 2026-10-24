import { useState } from "react";
import { imageExtension } from "../../../../utils/imageExtension";
import {
  Card,
  SoftButton,
  PrimaryButton,
  GhostButton,
  EmptyState,
  DiagramPreview,
  FieldLabel,
  RemoveButton,
  inputClass,
  singleLineClass,
} from "../../../common/ui/primitives";
import type { UmlClass } from "../../../../types/workflow";

interface ClassDraft {
  name: string;
  attributes: string[];
  methods: string[];
}

interface Props {
  viewMode?: "configuration" | "diagram" | "all";
  umlClasses: UmlClass[];
  classDiagramUrl: string | null;
  classDiagramCode: string | null;
  editingClassId: number | null;
  setEditingClassId: (id: number | null) => void;
  setEditingClassDraft?: (id: number, draft: ClassDraft) => void;
  onSaveClass: (id: number, draft: ClassDraft) => Promise<void>;
  onDeleteClass: (id: number) => Promise<void>;
  onRegenerateClasses: () => Promise<void> | void;
  onConfirmClassDiagram: () => void;
  busy: boolean;
  projectId?: number;
  wrapClass: string;
}

export default function Step5ClassDiagram({
  viewMode = "all",
  umlClasses,
  classDiagramUrl,
  classDiagramCode,
  editingClassId,
  setEditingClassId,
  setEditingClassDraft,
  onSaveClass,
  onDeleteClass,
  onRegenerateClasses,
  onConfirmClassDiagram,
  busy,
  projectId,
  wrapClass,
}: Props) {
  const [draft, setDraft] = useState<ClassDraft>({ name: "", attributes: [], methods: [] });
  const [zoom, setZoom] = useState(1);
  const [showCode, setShowCode] = useState(false);

  const downloadImage = () => {
    if (!classDiagramUrl) return;
    const link = document.createElement("a");
    link.href = classDiagramUrl;
    link.download = "class-diagram." + imageExtension(classDiagramUrl);
    link.target = "_blank";
    link.rel = "noreferrer";
    link.click();
  };

  const updateInline = (item: UmlClass, next: ClassDraft) => {
    setDraft(next);
    setEditingClassDraft?.(item.id, next);
    void onSaveClass(item.id, next);
  };

  const updateMember = (item: UmlClass, kind: "attributes" | "methods", index: number, value: string) => {
    const current: ClassDraft = {
      name: item.name,
      attributes: [...item.attributes],
      methods: [...item.methods],
    };
    current[kind][index] = value;
    setDraft(current);
    setEditingClassDraft?.(item.id, current);
  };

  const saveMemberDraft = (item: UmlClass) => {
    const current = draft.name || draft.attributes.length || draft.methods.length
      ? draft
      : { name: item.name, attributes: [...item.attributes], methods: [...item.methods] };
    void onSaveClass(item.id, current);
  };

  const deleteMember = (item: UmlClass, kind: "attributes" | "methods", index: number) => {
    const next: ClassDraft = {
      name: item.name,
      attributes: [...item.attributes],
      methods: [...item.methods],
    };
    next[kind].splice(index, 1);
    updateInline(item, next);
  };

  const addMember = (item: UmlClass, kind: "attributes" | "methods") => {
    const next: ClassDraft = {
      name: item.name,
      attributes: [...item.attributes],
      methods: [...item.methods],
    };
    next[kind].push("");
    setDraft(next);
    setEditingClassDraft?.(item.id, next);
    void onSaveClass(item.id, next);
  };

  const regenerate = () => {
    void onRegenerateClasses();
  };

  const remove = (item: UmlClass) => {
    if (!window.confirm(`Xoá lớp “${item.name}”?`)) return;
    void onDeleteClass(item.id);
  };

  return (
    <div className="space-y-3 pb-44 sm:pb-48">
      {(viewMode === "configuration" || viewMode === "all") && <Card
        tone="emerald"
        title="" className=""
      >
        <div className="mb-3 flex min-w-0 items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center text-3xl font-bold leading-none tracking-tight text-emerald-900">
            {umlClasses.length}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-800">Lớp UML được tạo</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {umlClasses.length > 0 ? "Các lớp và thành phần có thể chỉnh sửa trực tiếp bên dưới" : "Chưa có lớp nào được tạo"}
            </div>
          </div>
          <div className="ml-auto shrink-0">
            <SoftButton disabled={busy || !projectId} onClick={regenerate}>
              {busy
                ? "Đang suy luận..."
                : umlClasses.length > 0
                  ? "↻ Sinh lại mô hình lớp"
                  : "Sinh các lớp"}
            </SoftButton>
          </div>
        </div>
        {umlClasses.length === 0 ? (
          <EmptyState icon="◫" title="Chưa có lớp" />
        ) : (
          <div className="max-h-[72vh] space-y-3 overflow-y-auto overscroll-contain p-1 pb-4">
            {umlClasses.map((item, index) => (
              <article key={item.id} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-emerald-300 hover:shadow-md">
                <div className="flex min-w-0 items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-3 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-100 text-sm font-bold leading-none text-emerald-800">{index + 1}</span>
                  <div className="flex min-w-0 flex-1 items-center">
                    <input
                      aria-label="Tên lớp"
                      defaultValue={item.name}
                      key={item.id + ":" + item.name}
                      disabled={busy}
                      onBlur={(event) => {
                        const name = event.currentTarget.value.trim();
                        if (name && name !== item.name) updateInline(item, { name, attributes: [...item.attributes], methods: [...item.methods] });
                      }}
                      className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-base font-bold text-slate-800 outline-none hover:border-slate-200 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-3 p-3 lg:grid-cols-2">
                  <section className="flex min-w-0 items-start gap-2">
                    <span className="shrink-0 pt-1 text-[12px] font-semibold text-emerald-800">Thuộc tính</span>
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      {item.attributes.map((value, valueIndex) => (
                        <div key={valueIndex} className="inline-flex max-w-full items-center gap-1 rounded-md border border-emerald-200 bg-white pl-2 pr-1 py-0.5">
                          <input
                            aria-label={`Thuộc tính ${valueIndex + 1}`}
                            defaultValue={value}
                            key={item.id + ":attr:" + valueIndex + ":" + value}
                            disabled={busy}
                            onBlur={(event) => {
                              if (event.currentTarget.value !== value) {
                                const attributes = [...item.attributes];
                                attributes[valueIndex] = event.currentTarget.value;
                                updateInline(item, { name: item.name, attributes, methods: [...item.methods] });
                              }
                            }}
                            className="w-full min-w-[4rem] max-w-full bg-transparent text-[13px] leading-5 text-slate-700 outline-none"
                          />
                          <button type="button" aria-label="Xóa thuộc tính" title="Xóa thuộc tính" disabled={busy} onClick={() => deleteMember(item, "attributes", valueIndex)} className="rounded px-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">×</button>
                        </div>
                      ))}
                      <button type="button" disabled={busy} onClick={() => addMember(item, "attributes")} className="rounded px-1.5 py-0.5 text-xs text-emerald-700 hover:bg-emerald-50">+ Thêm</button>
                    </div>
                  </section>
                  <section className="flex min-w-0 items-start gap-2">
                    <span className="shrink-0 pt-1 text-[12px] font-semibold text-sky-800">Phương thức</span>
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      {item.methods.map((value, valueIndex) => (
                        <div key={valueIndex} className="inline-flex max-w-full items-center gap-1 rounded-md border border-sky-200 bg-white pl-2 pr-1 py-0.5">
                          <input
                            aria-label={`Phương thức ${valueIndex + 1}`}
                            defaultValue={value}
                            key={item.id + ":method:" + valueIndex + ":" + value}
                            disabled={busy}
                            onBlur={(event) => {
                              if (event.currentTarget.value !== value) {
                                const methods = [...item.methods];
                                methods[valueIndex] = event.currentTarget.value;
                                updateInline(item, { name: item.name, attributes: [...item.attributes], methods });
                              }
                            }}
                            className="w-full min-w-[4rem] max-w-full bg-transparent text-[13px] leading-5 text-slate-700 outline-none"
                          />
                          <button type="button" aria-label="Xóa phương thức" title="Xóa phương thức" disabled={busy} onClick={() => deleteMember(item, "methods", valueIndex)} className="rounded px-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">×</button>
                        </div>
                      ))}
                      <button type="button" disabled={busy} onClick={() => addMember(item, "methods")} className="rounded px-1.5 py-0.5 text-xs text-sky-700 hover:bg-sky-50">+ Thêm</button>
                    </div>
                  </section>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>}

      {(viewMode === "diagram" || viewMode === "all") && <Card compact allowOverflow className="!p-3">
        <div className="mb-3 flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-slate-200 pb-3">
          <PrimaryButton disabled={busy || !projectId} onClick={regenerate}>{busy ? "Đang sinh..." : classDiagramCode ? "↻ Sinh lại biểu đồ" : "Sinh biểu đồ"}</PrimaryButton>
          <SoftButton disabled={!classDiagramUrl} onClick={downloadImage}>↓ Tải ảnh về</SoftButton>
          <SoftButton disabled={!classDiagramCode} onClick={() => setShowCode((value) => !value)}>{showCode ? "Ẩn UML" : "Mã UML"}</SoftButton>
          <span className="mx-1 h-6 border-l border-slate-200" />
          <SoftButton disabled={!classDiagramUrl || zoom <= 0.1} onClick={() => setZoom((value) => Math.max(0.1, Number((value - 0.1).toFixed(2))))}>−</SoftButton>
          <span className="min-w-12 text-center text-sm tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
          <SoftButton disabled={!classDiagramUrl || zoom >= 2.5} onClick={() => setZoom((value) => Math.min(2.5, Number((value + 0.1).toFixed(2))))}>+</SoftButton>
          <SoftButton disabled={!classDiagramUrl || zoom === 1} onClick={() => setZoom(1)}>Vừa khung</SoftButton>
          <div className="ml-auto shrink-0"><PrimaryButton disabled={busy || !classDiagramUrl || !classDiagramCode} onClick={onConfirmClassDiagram}>Lưu biểu đồ</PrimaryButton></div>
        </div>
        <div className={`grid min-w-0 items-start gap-3 ${showCode ? "grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]" : "grid-cols-1"}`}>
          <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="relative flex h-[min(68vh,760px)] min-h-[360px] items-start justify-start overflow-auto bg-slate-50 p-3 sm:p-4">
              {classDiagramUrl ? <div className="flex min-h-full w-max min-w-full items-center justify-center"><img src={classDiagramUrl} alt="Biểu đồ lớp" draggable={false} style={{ width: `${zoom * 100}%`, height: "auto", maxWidth: "none", flexShrink: 0 }} className="block rounded-md bg-white object-contain shadow-sm" /></div> : <div className="flex min-h-[360px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 text-center"><p className="text-sm text-slate-500">Chưa có biểu đồ</p><div className="mt-3"><PrimaryButton disabled={busy || !projectId} onClick={regenerate}>Sinh biểu đồ</PrimaryButton></div></div>}
            </div>
          </section>
          {showCode && <section className="flex h-[min(68vh,760px)] min-h-[360px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="min-h-0 flex-1 bg-[#102d24] p-3"><pre className="uml-code-panel h-full min-h-0 overflow-auto whitespace-pre-wrap break-words border-0 bg-transparent p-2 font-mono text-xs leading-5 text-emerald-100 [overflow-wrap:anywhere]">{classDiagramCode || "Mã PlantUML sẽ xuất hiện tại đây sau khi sinh biểu đồ."}</pre></div></section>}
        </div>
      </Card>}

    </div>
  );
}

function ClassEditor({
  draft,
  busy,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: ClassDraft;
  busy: boolean;
  onChange: (next: ClassDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-transparent p-4">
      <div className="min-w-0">
        <FieldLabel>Tên lớp</FieldLabel>
        <input
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          aria-label="Tên lớp"
          className={singleLineClass}
        />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <FieldLabel hint={`${draft.attributes.length} thuộc tính`}>Thuộc tính</FieldLabel>
          <LineListEditor
            items={draft.attributes}
            onChange={(lines) => onChange({ ...draft, attributes: lines })}
            placeholder="Ví dụ: - maDonHang: string"
            addLabel="+ Thêm thuộc tính"
            removeLabel="Xóa thuộc tính"
          />
        </div>
        <div className="min-w-0">
          <FieldLabel hint={`${draft.methods.length} phương thức`}>Phương thức</FieldLabel>
          <LineListEditor
            items={draft.methods}
            onChange={(lines) => onChange({ ...draft, methods: lines })}
            placeholder="Ví dụ: + taoDonHang(): void"
            addLabel="+ Thêm phương thức"
            removeLabel="Xóa phương thức"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GhostButton disabled={busy} onClick={onDelete}>
          Xoá lớp
        </GhostButton>
        <div className="flex flex-wrap items-center gap-3">
          <GhostButton onClick={onCancel}>Huỷ</GhostButton>
          <PrimaryButton disabled={busy || !draft.name.trim()} onClick={onSave}>
            {busy ? "Đang lưu..." : "Lưu lớp"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function LineListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
  removeLabel,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
  removeLabel: string;
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
            onChange={(event) =>
              onChange(rows.map((item, i) => (i === index ? event.target.value : item)))
            }
            className={`${inputClass} min-h-16 resize-y whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}
          />
          {rows.length > 1 && (
            <RemoveButton
              label={removeLabel}
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, ""])}
        className="inline-flex h-9 items-center gap-1 rounded-lg px-1 text-sm font-medium text-emerald-600 transition hover:text-emerald-800"
      >
        {addLabel}
      </button>
    </div>
  );
}