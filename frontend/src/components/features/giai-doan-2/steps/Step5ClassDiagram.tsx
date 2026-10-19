import { useState } from "react";
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

  const startEditing = (item: UmlClass) => {
    const next = { name: item.name, attributes: [...item.attributes], methods: [...item.methods] };
    setDraft(next);
    setEditingClassDraft?.(item.id, next);
    setEditingClassId(item.id);
  };

  const changeDraft = (id: number, next: ClassDraft) => {
    setDraft(next);
    setEditingClassDraft?.(id, next);
  };

  const regenerate = () => {
    if (
      umlClasses.length > 0 &&
      !window.confirm(
        "Mô hình lớp hiện tại, kể cả phần bạn đã sửa tay, sẽ bị thay bằng kết quả mới từ AI. Bạn có muốn tiếp tục?",
      )
    ) {
      return;
    }
    void onRegenerateClasses();
  };

  const remove = (item: UmlClass) => {
    if (!window.confirm(`Xoá lớp “${item.name}”?`)) return;
    void onDeleteClass(item.id);
  };

  return (
    <div className="space-y-3">
      <Card
        tone="emerald"
        title="Mô hình lớp suy luận"
        actions={
          <SoftButton disabled={busy || !projectId} onClick={regenerate}>
            {busy
              ? "Đang suy luận..."
              : umlClasses.length > 0
                ? "↻ Sinh lại mô hình lớp"
                : "Sinh biểu đồ lớp"}
          </SoftButton>
        }
      >
        {umlClasses.length === 0 ? (
          <EmptyState
            icon="◫"
            title="Chưa có lớp trong database"
            hint="Bấm “Sinh biểu đồ lớp” để suy luận mô hình lớp từ các kịch bản use case."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-slate-50/70">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Lớp</th>
                  <th className="px-4 py-3">Thuộc tính</th>
                  <th className="px-4 py-3">Phương thức</th>
                  <th className="px-4 py-3">Sửa</th>
                </tr>
              </thead>
              <tbody>
                {umlClasses.map((item) =>
                  editingClassId === item.id ? (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td colSpan={4} className="p-4">
                        <ClassEditor
                          draft={draft}
                          busy={busy}
                          onChange={(next) => changeDraft(item.id, next)}
                          onSave={() => void onSaveClass(item.id, draft)}
                          onCancel={() => setEditingClassId(null)}
                          onDelete={() => remove(item)}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.id} className="border-t border-slate-100 align-top">
                      <th className={`max-w-48 px-4 py-3 font-semibold text-slate-800 ${wrapClass}`}>
                        {item.name}
                      </th>
                      <td className="min-w-0 px-4 py-3">
                        <ul className="space-y-1">
                          {item.attributes.map((value, index) => (
                            <li key={index} className={`text-slate-600 ${wrapClass}`}>
                              {value}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="min-w-0 px-4 py-3">
                        <ul className="space-y-1">
                          {item.methods.map((value, index) => (
                            <li key={index} className={`text-slate-600 ${wrapClass}`}>
                              {value}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startEditing(item)}
                          className="text-xs text-emerald-600 hover:underline disabled:opacity-50"
                        >
                          ✎ Sửa
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Mô hình UML" subtitle="Kiểm tra biểu đồ lớp rồi xác nhận để sang bước tiếp theo" tone="emerald">
        <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(15rem,0.38fr)]">
          <div className="min-w-0 overflow-hidden rounded-xl bg-emerald-50/70 p-2">
            <div className="max-h-[min(54vh,460px)] min-h-[250px] overflow-auto">
              <DiagramPreview
                imageUrl={classDiagramUrl}
                emptyTitle="Chưa có ảnh biểu đồ lớp"
                emptyHint="Sinh mô hình lớp ở trên để tạo biểu đồ."
                downloadName="class-diagram.svg"
              />
            </div>
          </div>
          <section className="flex min-w-0 flex-col overflow-hidden rounded-xl bg-white ring-1 ring-emerald-100">
            <div className="flex items-center gap-2 border-b border-emerald-100 px-3 py-2">
              <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">Mã</span>
              <span className="rounded-md px-2.5 py-1 text-xs text-slate-500">PlantUML</span>
            </div>
            <pre className="uml-code-panel min-h-[250px] max-h-[min(54vh,460px)] flex-1 overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-5 [overflow-wrap:anywhere]">
              {classDiagramCode || "Mã PlantUML sẽ xuất hiện tại đây sau khi sinh biểu đồ."}
            </pre>
          </section>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_8px_30px_-24px_rgba(10,51,35,0.4)] sm:px-5">
        <p className="text-sm text-slate-700">Xác nhận mô hình lớp và biểu đồ lớp</p>
        <PrimaryButton
          disabled={busy || umlClasses.length === 0 || !classDiagramUrl}
          onClick={onConfirmClassDiagram}
        >
          Xác nhận mô hình lớp và hoàn tất
        </PrimaryButton>
      </div>
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
    <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="min-w-0">
        <FieldLabel>Tên lớp</FieldLabel>
        <input
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          aria-label="Tên lớp"
          className={singleLineClass}
        />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
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