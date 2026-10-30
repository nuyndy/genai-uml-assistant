import { useMemo, useRef } from "react";
import { Card, PrimaryButton, SoftButton, Notice } from "../../../common/ui/primitives";

interface Props {
  state: { diagramCode: string; previewImageUrl?: string | null };
  stage3Message?: string;
  setState: (updater: (prev: any) => any) => void;
  consistencyResult: any;
  busy: boolean;
  onConsistencyCheck: () => Promise<void>;
  onSaveDiagram: () => Promise<void>;
  onFixWithAI: () => Promise<void>;
  onDiagramChange?: () => void;
}

type Issue = { id: string; title: string; detail: string; lineHint?: string; tone: "amber" | "rose" | "slate" };

export default function Step2ChinhSuaCapNhat({
  state,
  setState,
  consistencyResult,
  stage3Message,
  busy,
  onConsistencyCheck,
  onSaveDiagram,
  onFixWithAI,
  onDiagramChange,
}: Props) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const missingDb = consistencyResult?.missing_in_database ?? [];
  const missingPlantUml = consistencyResult?.missing_in_plantuml ?? [];
  const missingRelations = consistencyResult?.missing_relations ?? [];
  const extraRelations = consistencyResult?.extra_relations ?? [];
  const crossStageIssues: string[] = consistencyResult?.cross_stage_issues ?? [];
  const totalIssues = missingDb.length + missingPlantUml.length + missingRelations.length + extraRelations.length + crossStageIssues.length;
  const hasResult = consistencyResult != null;

  const issues: Issue[] = useMemo(() => [
    ...missingDb.map((item: string, index: number) => ({
      id: `db-${index}`, title: "Thiếu trong dữ liệu đã lưu", detail: String(item), lineHint: String(item), tone: "amber" as const,
    })),
    ...missingPlantUml.map((item: string, index: number) => ({
      id: `puml-${index}`, title: "Thiếu trong PlantUML", detail: String(item), lineHint: String(item), tone: "amber" as const,
    })),
    ...missingRelations.map((item: any, index: number) => ({
      id: `missing-rel-${index}`, title: "Thiếu quan hệ trong PlantUML",
      detail: `${item.from} → ${item.to}${item.type ? ` (${item.type})` : ""}`,
      lineHint: String(item.from ?? ""), tone: "rose" as const,
    })),
    ...extraRelations.map((item: any, index: number) => ({
      id: `extra-rel-${index}`, title: "Quan hệ thừa trong PlantUML",
      detail: `${item.from} → ${item.to}${item.type ? ` (${item.type})` : ""}`,
      lineHint: String(item.from ?? ""), tone: "rose" as const,
    })),
    ...crossStageIssues.map((item, index) => ({
      id: `cross-stage-${index}`, title: "Vấn đề xuyên Giai đoạn 1–3",
      detail: item, tone: "amber" as const,
    })),
  ], [missingDb, missingPlantUml, missingRelations, extraRelations, crossStageIssues]);

  const focusIssue = (issue: Issue) => {
    const editor = editorRef.current;
    if (!editor) return;
    const lines = state.diagramCode.split("\n");
    const terms = [issue.lineHint, ...issue.detail.split(/\s+→\s+|\s+\(.*\)$/)].filter((value): value is string => Boolean(value?.trim()));
    let lineIndex = -1;
    for (const term of terms) {
      const normalized = term.replace(/^["'`]|["'`]$/g, "").trim();
      if (!normalized) continue;
      lineIndex = lines.findIndex((line) => line.toLowerCase().includes(normalized.toLowerCase()));
      if (lineIndex >= 0) break;
    }
    if (lineIndex < 0) {
      const relation = issue.detail.match(/([^→]+)→\s*([^ (]+)/);
      if (relation) {
        lineIndex = lines.findIndex((line) => line.includes(relation[1].trim()) && line.includes(relation[2].trim()));
      }
    }
    if (lineIndex < 0) return;
    const start = lines.slice(0, lineIndex).reduce((sum, line) => sum + line.length + 1, 0);
    const end = start + lines[lineIndex].length;
    editor.focus();
    editor.setSelectionRange(start, end);
    const lineHeight = 24;
    editor.scrollTop = Math.max(0, lineIndex * lineHeight - editor.clientHeight / 2);
  };

  const toneClasses = {
    amber: "border-amber-200 bg-amber-50/70",
    rose: "border-rose-200 bg-rose-50/70",
    slate: "border-slate-200 bg-white",
  };

  return (
    <div className="space-y-4 pb-2">
      <Card
        tone="emerald"
        actions={
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
            {hasResult && (
              <div className="min-w-0 flex-1 [&>div]:w-full">
                <Notice tone={totalIssues > 0 ? "info" : "success"}>
                  {totalIssues > 0 ? `Có ${totalIssues} sai lệch cần xử lý.` : "Không phát hiện sai lệch."}
                </Notice>
              </div>
            )}
            <SoftButton disabled={busy || !state.diagramCode.trim()} onClick={onSaveDiagram}>
              {busy ? "Đang lưu..." : "Lưu chỉnh sửa"}
            </SoftButton>
            <SoftButton disabled={busy} onClick={onFixWithAI}>
              {busy ? "Đang sửa bằng AI..." : "Sửa bằng AI"}
            </SoftButton>
            <PrimaryButton disabled={busy || !state.diagramCode.trim()} onClick={onConsistencyCheck}>
              {busy ? "Đang xử lý..." : "Kiểm tra lại"}
            </PrimaryButton>
          </div>
        }
      >
        {stage3Message && (
          <div className="mb-4">
            <Notice tone="info">
              {stage3Message}
            </Notice>
          </div>
        )}
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.6fr)]">
          <section className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Danh sách sai lệch</h3>
              {hasResult && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{totalIssues} mục</span>}
            </div>
            {!hasResult ? (
              <div className="flex min-h-56 flex-1 flex-col items-center justify-center rounded-lg bg-slate-50 px-4 py-8 text-center">
                <p className="text-sm font-medium text-slate-700">Chưa có kết quả kiểm tra</p>
                <p className="mt-1 text-sm text-slate-500">Chọn “Kiểm tra lại” để tìm sai lệch giữa mã và dữ liệu UML.</p>
              </div>
            ) : totalIssues === 0 ? (
              <div className="flex min-h-40 flex-1 items-center justify-center rounded-lg bg-emerald-50 px-4 py-8 text-center text-sm font-medium text-emerald-800">
                Không phát hiện sai lệch trong mã PlantUML và các liên kết dữ liệu Giai đoạn 1–3.
              </div>
            ) : (
              <div className="space-y-2">
                {issues.map((issue, index) => (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => focusIssue(issue)}
                    className={`group w-full rounded-lg border p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/60 focus:outline-none focus:ring-2 focus:ring-blue-200 ${toneClasses[issue.tone]}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${issue.tone === "rose" ? "bg-rose-100 text-rose-700" : issue.tone === "amber" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-5 text-slate-800">{issue.title}</p>
                        <p className="mt-1 break-words text-sm leading-5 text-slate-600">{issue.detail}</p>
                        <p className="mt-2 text-xs font-medium text-blue-700 group-hover:underline">Định vị trong mã ↗</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Mã PlantUML</h3>
              <span className="text-xs text-slate-500">Chọn một sai lệch để định vị dòng mã</span>
            </div>
            <textarea
              ref={editorRef}
              value={state.diagramCode}
              onChange={(event) => { setState((prev) => ({ ...prev, diagramCode: event.target.value, consistencyChecked: false, baselineApproved: false })); onDiagramChange?.(); }}
              spellCheck={false}
              aria-label="Chỉnh sửa mã PlantUML"
              wrap="off"
              className="min-h-[320px] max-h-[calc(100vh-280px)] w-full resize-y rounded-lg border border-slate-700 bg-[#20252d] p-4 font-mono text-sm leading-6 text-slate-100 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              placeholder="@startuml\n...\n@enduml"
            />
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Chọn sai lệch liên quan đến mã để định vị dòng. Nút “Sửa bằng AI” chỉnh mã PlantUML và cập nhật bản xem trước; các vấn đề thiếu yêu cầu, User Story, đặc tả, Use Case hoặc biểu đồ tương tác cần xử lý ở giai đoạn tương ứng. Sau khi xem kết quả, chọn “Lưu chỉnh sửa” để lưu vào dự án rồi kiểm tra lại.
            </p>
            {state.previewImageUrl && (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Bản xem trước biểu đồ sau chỉnh sửa</div>
                <div className="flex max-h-[420px] min-h-40 items-center justify-center overflow-auto p-3">
                  <img src={state.previewImageUrl} alt="Bản xem trước biểu đồ lớp PlantUML" className="max-w-full object-contain" />
                </div>
              </div>
            )}
          </section>
        </div>
      </Card>
    </div>
  );
}
