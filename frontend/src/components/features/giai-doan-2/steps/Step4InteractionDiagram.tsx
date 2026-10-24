import { useMemo, useState } from "react";
import {
  Card,
  SoftButton,
  PrimaryButton,
  GhostButton,
  EmptyState,
  DiagramPreview,
} from "../../../common/ui/primitives";
import type { InteractionType } from "../../../../types/workflow";

interface ScenarioUseCase {
  id: number;
  name: string;
}

interface InteractionItem {
  id?: number; // id của diagram trong database, cần để lưu mã đã sửa
  usecaseId: number;
  type: InteractionType;
  imageUrl: string | null;
  sourceCode: string | null;
}

interface Props {
  scenarios: ScenarioUseCase[];
  interactions: InteractionItem[];
  currentDiagramType: InteractionType;
  setDiagramType: (type: InteractionType) => void;
  busy: boolean;
  projectId?: number;
  onGenerateBatch: () => void | Promise<void>;
  onGenerateSingle: (useCaseId: number) => void | Promise<void>;
  onSaveDiagram: (diagramId: number, code: string) => void | Promise<void>;
  onConfirm: () => void;
  confirmed: boolean;
  onStepChange: (step: number) => void;
  wrapClass: string;
  inputClass?: string;
}

const DIAGRAM_TYPES: { value: InteractionType; label: string }[] = [
  { value: "sequence", label: "Sequence" },
  { value: "collaboration", label: "Collaboration" },
];

export default function Step4InteractionDiagram({
  scenarios,
  interactions,
  currentDiagramType,
  setDiagramType,
  busy,
  projectId,
  onGenerateBatch,
  onGenerateSingle,
  onSaveDiagram,
  onConfirm,
  confirmed,
  wrapClass,
  inputClass = "w-full rounded-lg border border-slate-300 p-3 text-sm",
}: Props) {
  void confirmed;
  void onConfirm;
  const [editingUseCaseId, setEditingUseCaseId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(0);
  const [codeVisible, setCodeVisible] = useState<Record<number, boolean>>({});
  const [zoom, setZoom] = useState<Record<number, number>>({});
  const pageSize = 2;
  const pageCount = Math.max(1, Math.ceil(scenarios.length / pageSize));
  const visibleScenarios = useMemo(() => scenarios.slice(page * pageSize, page * pageSize + pageSize), [scenarios, page]);

  const startEditing = (useCaseId: number, code: string) => {
    setDraft(code);
    setEditingUseCaseId(useCaseId);
  };

  const saveEditing = async (diagramId: number) => {
    await onSaveDiagram(diagramId, draft);
    setEditingUseCaseId(null);
  };

  return (
    <div className="space-y-3">
      <Card
        tone="emerald"
        title={undefined}
        actions={null}
      >
        {scenarios.length === 0 ? (
          <EmptyState
            title="Chưa có kịch bản"
            hint="Sinh kịch bản cho use case ở Bước 3 trước."
          />
        ) : (
          <div className="space-y-3">
            {visibleScenarios.map((useCase) => {
              const diagram = interactions.find(
                (item) => item.usecaseId === useCase.id && item.type === currentDiagramType,
              );
              const editing = editingUseCaseId === useCase.id;
              return (
                <section
                  key={useCase.id}
                  className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2 overflow-x-auto border-b border-emerald-100 bg-emerald-50/60 px-3 py-2">
                    <button type="button" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="shrink-0 rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs disabled:opacity-30">‹</button>
                    <h3 title={useCase.name} className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-slate-900">{useCase.name}</h3>
                    <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} className="shrink-0 rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-xs disabled:opacity-30">›</button>
                    <div className="flex shrink-0 rounded-lg border border-slate-200 bg-white p-1">
                      {DIAGRAM_TYPES.map(({ value, label }) => <button key={value} type="button" onClick={() => setDiagramType(value)} className={`rounded-md px-2 py-1.5 text-xs font-semibold ${currentDiagramType === value ? "bg-emerald-800 text-white" : "text-slate-600 hover:bg-emerald-50"}`}>{label}</button>)}
                    </div>
                    <button type="button" title="Thu nhỏ" onClick={() => setZoom(v => ({...v, [useCase.id]: Math.max(50, (v[useCase.id] ?? 100) - 10)}))} className="shrink-0 rounded-md border px-2 py-1.5 text-xs">−</button>
                    <span className="shrink-0 text-xs">{zoom[useCase.id] ?? 100}%</span>
                    <button type="button" title="Phóng to" onClick={() => setZoom(v => ({...v, [useCase.id]: Math.min(200, (v[useCase.id] ?? 100) + 10)}))} className="shrink-0 rounded-md border px-2 py-1.5 text-xs">+</button>
                    <button type="button" onClick={() => setZoom(v => ({...v, [useCase.id]: 100}))} className="shrink-0 whitespace-nowrap rounded-md border px-2 py-1.5 text-xs">Vừa khung</button>
                    {diagram?.imageUrl && <a href={diagram.imageUrl} download={currentDiagramType + '-' + useCase.id + '.svg'} className="shrink-0 whitespace-nowrap rounded-md border px-2 py-1.5 text-xs text-emerald-800">↓ Tải ảnh về</a>}
                    <span className="shrink-0 whitespace-nowrap text-xs text-emerald-700">{diagram?.imageUrl ? "✓ Đã lưu" : "Chưa có biểu đồ"}</span>
                    <SoftButton disabled={busy || !projectId} onClick={() => void onGenerateSingle(useCase.id)}>↻ Sinh lại UC này</SoftButton>
                    <SoftButton disabled={busy || !projectId} onClick={() => void onGenerateBatch()}>Sinh lại tất cả</SoftButton>
                  </div>

                  <div className="grid min-w-0 grid-cols-1 gap-3 p-3 lg:grid-cols-2">
                    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <button type="button" title="Thu nhỏ" onClick={() => setZoom(v => ({...v, [useCase.id]: Math.max(50, (v[useCase.id] ?? 100) - 10)}))} className="rounded-md border px-2 py-1 text-xs">−</button>
                            <span className="min-w-12 text-center text-xs text-slate-600">{zoom[useCase.id] ?? 100}%</span>
                            <button type="button" title="Phóng to" onClick={() => setZoom(v => ({...v, [useCase.id]: Math.min(200, (v[useCase.id] ?? 100) + 10)}))} className="rounded-md border px-2 py-1 text-xs">+</button>
                            <button type="button" title="Vừa khung" onClick={() => setZoom(v => ({...v, [useCase.id]: 100}))} className="rounded-md border px-2 py-1 text-xs">Vừa khung</button>
                          </div>
                          {diagram?.imageUrl && <a href={diagram.imageUrl} download={`${currentDiagramType}-${useCase.id}.svg`} className="rounded-md border px-2 py-1 text-xs text-emerald-800">↓ Tải ảnh về</a>}
                        </div>
                        <div className="max-h-[min(42vh,360px)] min-h-[220px] overflow-auto">
                          <div style={{ transform: 'scale(' + ((zoom[useCase.id] ?? 100) / 100) + ')', transformOrigin: 'top left', width: (10000 / (zoom[useCase.id] ?? 100)) + '%' }}>
                            <DiagramPreview imageUrl={diagram?.imageUrl ?? null} emptyTitle={diagram ? "Mã biểu đồ đã lưu, ảnh chưa sẵn sàng" : "Chưa có biểu đồ tương tác"} emptyHint="Biểu đồ được lưu riêng cho từng use case." downloadName={currentDiagramType + '-' + useCase.id + '.svg'} />
                          </div>
                        </div>
                      </div>
                    </div>
                    {diagram?.sourceCode && diagram.id !== undefined ? (
                      <div className="min-w-0 overflow-hidden rounded-xl bg-[#102d24]">
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-emerald-50">
                          <button type="button" onClick={() => setCodeVisible((v) => ({ ...v, [useCase.id]: !(v[useCase.id] ?? true) }))} className="text-xs font-semibold text-emerald-100">Mã UML {((codeVisible[useCase.id] ?? true) ? "−" : "+")}</button>
                          {!editing && (
                            <GhostButton disabled={busy} onClick={() => startEditing(useCase.id, diagram.sourceCode ?? "")}>
                              ✎ Sửa mã
                            </GhostButton>
                          )}
                        </div>
                        {(codeVisible[useCase.id] ?? true) && (editing ? (
                          <div className="space-y-3 border-t border-white/10 p-3">
                            <textarea
                              value={draft}
                              onChange={(event) => setDraft(event.target.value)}
                              rows={8}
                              spellCheck={false}
                              className={`${inputClass} min-h-40 resize-y border-white/10 bg-[#0b211a] font-mono text-xs leading-5 whitespace-pre text-emerald-100 placeholder:text-emerald-700 focus:border-emerald-500 focus:ring-emerald-900`}
                            />
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <GhostButton onClick={() => setEditingUseCaseId(null)}>Đóng</GhostButton>
                              <PrimaryButton disabled={busy || !draft.trim()} onClick={() => void saveEditing(diagram.id as number)}>
                                {busy ? "Đang lưu..." : "Lưu mã"}
                              </PrimaryButton>
                            </div>
                          </div>
                        ) : (
                          <pre className="uml-code-panel max-h-[min(42vh,360px)] min-h-[220px] overflow-auto whitespace-pre-wrap break-words border-t border-white/10 p-3 text-xs leading-5 [overflow-wrap:anywhere]">
                            {diagram.sourceCode}
                          </pre>
                        ))}
                      </div>
                    ) : (
                      <div className="flex min-h-[220px] items-center justify-center rounded-xl bg-white px-4 text-center text-sm text-slate-500">
                        Mã PlantUML sẽ xuất hiện sau khi sinh biểu đồ.
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
        {scenarios.length > pageSize && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-500">Đang xem {page * pageSize + 1}–{Math.min((page + 1) * pageSize, scenarios.length)} / {scenarios.length} Use Case</span>
            <div className="flex items-center gap-2">
              <GhostButton disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>‹ Trước</GhostButton>
              <span className="text-xs font-medium text-slate-600">{page + 1} / {pageCount}</span>
              <GhostButton disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Tiếp ›</GhostButton>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}