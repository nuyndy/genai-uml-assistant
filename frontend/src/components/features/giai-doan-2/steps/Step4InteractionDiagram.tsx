import { useState } from "react";
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
        title="Sinh biểu đồ tương tác"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-full bg-slate-100 p-1.5">
              {DIAGRAM_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDiagramType(value)}
                  className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                    currentDiagramType === value
                      ? "bg-emerald-800 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <PrimaryButton disabled={busy || !projectId} onClick={() => void onGenerateBatch()}>
              {busy ? "Đang sinh..." : "Sinh biểu đồ cho tất cả"}
            </PrimaryButton>
          </div>
        }
      >
        {scenarios.length === 0 ? (
          <EmptyState
            title="Chưa có kịch bản"
            hint="Sinh kịch bản cho use case ở Bước 3 trước."
          />
        ) : (
          <div className="space-y-3">
            {scenarios.map((useCase) => {
              const diagram = interactions.find(
                (item) => item.usecaseId === useCase.id && item.type === currentDiagramType,
              );
              const editing = editingUseCaseId === useCase.id;
              return (
                <section
                  key={useCase.id}
                  className="min-w-0 rounded-xl bg-slate-50/70 p-3 sm:p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className={`min-w-0 break-words font-semibold text-slate-900 ${wrapClass}`}>
                      {useCase.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {diagram?.imageUrl ? (
                        <span className="text-xs font-medium text-emerald-600">Đã render</span>
                      ) : (
                        <span className="text-xs text-slate-400">Chưa có biểu đồ</span>
                      )}
                      <SoftButton
                        disabled={busy || !projectId}
                        onClick={() => void onGenerateSingle(useCase.id)}
                      >
                        Sinh cho use case này
                      </SoftButton>
                    </div>
                  </div>

                  <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="min-w-0 overflow-hidden rounded-xl bg-emerald-50/70 p-2">
                      <div className="max-h-[min(42vh,360px)] min-h-[220px] overflow-auto">
                        <DiagramPreview
                          imageUrl={diagram?.imageUrl ?? null}
                          emptyTitle={diagram ? "Mã biểu đồ đã lưu, ảnh chưa sẵn sàng" : "Chưa có biểu đồ tương tác"}
                          emptyHint="Biểu đồ được lưu riêng cho từng use case."
                          downloadName={`${currentDiagramType}-${useCase.id}.svg`}
                        />
                      </div>
                    </div>
                    {diagram?.sourceCode && diagram.id !== undefined ? (
                      <div className="min-w-0 overflow-hidden rounded-xl bg-[#102d24]">
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-emerald-50">
                          <span className="text-xs font-semibold text-emerald-100">Mã PlantUML</span>
                          {!editing && (
                            <GhostButton disabled={busy} onClick={() => startEditing(useCase.id, diagram.sourceCode ?? "")}>
                              ✎ Sửa mã
                            </GhostButton>
                          )}
                        </div>
                        {editing ? (
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
                        )}
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
      </Card>


      <div className="flex flex-wrap items-center justify-between gap-3">
        
        
      </div>
    </div>
  );
}