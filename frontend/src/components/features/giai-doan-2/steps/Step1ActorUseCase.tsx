import { useMemo, useState } from "react";
import { Card, EmptyState, SoftButton } from "../../../common/ui/primitives";

interface ActorItem { id: number; name: string }
interface UseCaseItem { id: number; name: string; description?: string; specificationId?: number }
interface SuggestedActor { token: string; name: string }
interface SuggestedUseCase { token: string; specification_id: number; name: string; description: string }
interface Suggestions { actors: SuggestedActor[]; useCases: SuggestedUseCase[] }
interface RelationItem { id: number; from: string; to: string; type: string }
interface SpecificationItem { id: number; feature: string }
interface Props {
  projectId?: number;
  requirements: ActorItem[];
  requirementValues: UseCaseItem[];
  relations: RelationItem[];
  specifications: SpecificationItem[];
  analyses: Suggestions;
  loadingAnalysis: boolean;
  busy: boolean;
  loaded?: boolean;
  error?: string;
  runBatchAnalysis: () => void | Promise<void>;
  onSaveSuggestions: () => void | Promise<void>;
  onCreateActor: (name: string) => Promise<void>;
  onRenameActor: (id: number, name: string) => Promise<void>;
  onDeleteActor: (id: number) => Promise<void>;
  onCreateUseCase: (name: string, specificationId: number) => Promise<void>;
  onRenameUseCase: (id: number, name: string) => Promise<void>;
  onDeleteUseCase: (id: number) => Promise<void>;
  onLinkActor: (useCaseId: number, actorId: number) => Promise<void>;
  onUnlinkActor: (relationId: number) => Promise<void>;
  onConfirm: () => void;
  confirmed: boolean;
  onStepChange: (step: number) => void;
  wrapClass: string;
}
const ROW_HEIGHT = 64;

export default function Step1ActorUseCase({
  requirements: actors, requirementValues: useCases, relations, specifications,
  analyses: suggestions, loadingAnalysis, busy, runBatchAnalysis, onSaveSuggestions,
  onCreateActor, onRenameActor, onDeleteActor, onCreateUseCase, onRenameUseCase,
  onDeleteUseCase, onLinkActor, onUnlinkActor, wrapClass,
}: Props) {
  const [newActor, setNewActor] = useState("");
  const [newUseCase, setNewUseCase] = useState("");
  const [newUseCaseSpecification, setNewUseCaseSpecification] = useState("");
  const [linkingUseCaseId, setLinkingUseCaseId] = useState<number | null>(null);
  const [linkActorId, setLinkActorId] = useState("");
  const [selectedActorId, setSelectedActorId] = useState<number | null>(null);
  const [selectedUseCaseId, setSelectedUseCaseId] = useState<number | null>(null);
  const hasSuggestions = suggestions.actors.length > 0 || suggestions.useCases.length > 0;
  const graphHeight = Math.max(240, Math.max(actors.length, useCases.length, 1) * ROW_HEIGHT + 16);
  const actorIdsByName = useMemo(() => new Map(actors.map((item) => [item.name, item.id])), [actors]);
  const useCaseIdsByName = useMemo(() => new Map(useCases.map((item) => [item.name, item.id])), [useCases]);
  const visibleRelations = useMemo(() => relations.flatMap((relation) => {
    const actorId = actorIdsByName.get(relation.from);
    const useCaseId = useCaseIdsByName.get(relation.to);
    return actorId !== undefined && useCaseId !== undefined ? [{ ...relation, actorId, useCaseId }] : [];
  }), [relations, actorIdsByName, useCaseIdsByName]);
  const connectedUseCaseIds = useMemo(() => new Set(visibleRelations.filter((item) => item.actorId === selectedActorId).map((item) => item.useCaseId)), [visibleRelations, selectedActorId]);
  const connectedActorIds = useMemo(() => new Set(visibleRelations.filter((item) => item.useCaseId === selectedUseCaseId).map((item) => item.actorId)), [visibleRelations, selectedUseCaseId]);

  async function createActor() {
    const name = newActor.trim();
    if (!name) return;
    await onCreateActor(name);
    setNewActor("");
  }
  async function createUseCase() {
    const name = newUseCase.trim();
    const specificationId = Number(newUseCaseSpecification || specifications[0]?.id);
    if (!name || !Number.isFinite(specificationId) || specificationId <= 0) return;
    await onCreateUseCase(name, specificationId);
    setNewUseCase("");
    setNewUseCaseSpecification("");
  }

  return (
    <Card compact title="Tác nhân & Use Case"
      subtitle="Sơ đồ quan hệ · Chọn một nút để làm nổi bật liên kết · Sửa tên ngay trên sơ đồ"
      actions={<div className="flex flex-wrap gap-2">
        <SoftButton disabled={busy || loadingAnalysis} onClick={() => void runBatchAnalysis()}>
          {loadingAnalysis ? "Đang phân tích..." : hasSuggestions || actors.length ? "Phân tích lại bằng AI" : "Phân tích bằng AI"}
        </SoftButton>
        {hasSuggestions && <SoftButton disabled={busy || loadingAnalysis} onClick={() => void onSaveSuggestions()}>
          Thêm gợi ý ({suggestions.actors.length + suggestions.useCases.length})
        </SoftButton>}
      </div>}
    >
      {loadingAnalysis && <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Đang phân tích đặc tả chức năng...</p>}
      {hasSuggestions && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <strong>Gợi ý chưa lưu:</strong><span>{suggestions.actors.length} tác nhân</span><span>·</span><span>{suggestions.useCases.length} Use Case</span><span>Bấm “Thêm gợi ý” để đưa vào sơ đồ.</span>
      </div>}
      {actors.length === 0 && useCases.length === 0 ? (
        <EmptyState icon="◇" title="Sơ đồ chưa có thành phần" hint="Thêm tác nhân hoặc phân tích đặc tả bằng AI để bắt đầu." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-[#fbfdfc]">
          <div className="relative min-w-[760px] p-3">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-3" style={{ height: graphHeight }}>
              <svg className="h-full w-full" viewBox={`0 0 1000 ${graphHeight}`} preserveAspectRatio="none">
                {visibleRelations.map((relation) => {
                  const ai = actors.findIndex((item) => item.id === relation.actorId);
                  const ui = useCases.findIndex((item) => item.id === relation.useCaseId);
                  const y1 = 64 + ai * ROW_HEIGHT;
                  const y2 = 64 + ui * ROW_HEIGHT;
                  const active = selectedActorId === relation.actorId || selectedUseCaseId === relation.useCaseId;
                  const dim = (selectedActorId !== null || selectedUseCaseId !== null) && !active;
                  return <g key={relation.id} opacity={dim ? 0.13 : 1}>
                    <path d={`M 380 ${y1} C 445 ${y1}, 555 ${y2}, 620 ${y2}`} fill="none" stroke={active ? "#23835b" : "#9bb8ad"} strokeWidth={active ? 2.5 : 1.6} />
                    <circle cx="620" cy={y2} r="3.5" fill={active ? "#23835b" : "#9bb8ad"} />
                  </g>;
                })}
              </svg>
            </div>
            <div className="relative z-[1] grid grid-cols-[38%_38%] justify-between">
              <section className="min-w-0">
                <header className="mb-2 flex h-7 items-center justify-between"><h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tác nhân <span className="font-normal">({actors.length})</span></h4></header>
                <div className="space-y-2">
                  {actors.map((actor) => {
                    const selected = selectedActorId === actor.id;
                    const linked = selectedUseCaseId !== null && connectedActorIds.has(actor.id);
                    return <div key={actor.id} className={`group flex h-14 items-center gap-2 rounded-lg border px-2 ${selected || linked ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200" : "border-slate-200 bg-white hover:border-emerald-300"}`}>
                      <button type="button" aria-label={`Chọn tác nhân ${actor.name}`} onClick={() => { setSelectedActorId(selected ? null : actor.id); setSelectedUseCaseId(null); }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#e4f3e9] text-sm text-emerald-800">♙</button>
                      <input aria-label={`Tên tác nhân ${actor.name}`} key={`actor-${actor.id}-${actor.name}`} defaultValue={actor.name} disabled={busy}
                        onBlur={(event) => { const name = event.currentTarget.value.trim(); if (name && name !== actor.name) void onRenameActor(actor.id, name); else if (!name) event.currentTarget.value = actor.name; }}
                        onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { event.currentTarget.value = actor.name; event.currentTarget.blur(); } }}
                        className={`min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none ${wrapClass}`} />
                      <button type="button" title="Xóa tác nhân" aria-label={`Xóa tác nhân ${actor.name}`} disabled={busy} onClick={() => { if (window.confirm(`Xóa tác nhân “${actor.name}” và các liên kết liên quan?`)) void onDeleteActor(actor.id); }} className="rounded px-1.5 py-1 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100">×</button>
                    </div>;
                  })}
                </div>
                <form className="mt-2 flex gap-1.5" onSubmit={(event) => { event.preventDefault(); void createActor(); }}>
                  <input value={newActor} onChange={(event) => setNewActor(event.target.value)} disabled={busy} placeholder="+ Thêm tác nhân" aria-label="Tên tác nhân mới" className="h-9 min-w-0 flex-1 rounded-lg border border-dashed border-slate-300 bg-white px-2 text-xs outline-none focus:border-emerald-500" />
                  <button type="submit" disabled={busy || !newActor.trim()} className="h-9 rounded-lg bg-emerald-700 px-3 text-sm text-white disabled:opacity-40">+</button>
                </form>
              </section>
              <section className="min-w-0">
                <header className="mb-2 flex h-7 items-center justify-between"><h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Use Case <span className="font-normal">({useCases.length})</span></h4></header>
                <div className="space-y-2">
                  {useCases.map((useCase) => {
                    const ucRelations = visibleRelations.filter((item) => item.useCaseId === useCase.id);
                    const selected = selectedUseCaseId === useCase.id;
                    const linked = selectedActorId !== null && connectedUseCaseIds.has(useCase.id);
                    return <div key={useCase.id} className={`group h-14 overflow-hidden rounded-lg border px-2 py-1.5 ${selected || linked ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200" : "border-slate-200 bg-white hover:border-emerald-300"}`}>
                      <div className="flex h-7 items-center gap-2">
                        <button type="button" aria-label={`Chọn Use Case ${useCase.name}`} onClick={() => { setSelectedUseCaseId(selected ? null : useCase.id); setSelectedActorId(null); }} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-white text-xs text-emerald-800">○</button>
                        <input aria-label={`Tên Use Case ${useCase.name}`} key={`uc-${useCase.id}-${useCase.name}`} defaultValue={useCase.name} disabled={busy}
                          onBlur={(event) => { const name = event.currentTarget.value.trim(); if (name && name !== useCase.name) void onRenameUseCase(useCase.id, name); else if (!name) event.currentTarget.value = useCase.name; }}
                          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { event.currentTarget.value = useCase.name; event.currentTarget.blur(); } }}
                          className={`min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none ${wrapClass}`} />
                        <button type="button" title="Xóa Use Case" aria-label={`Xóa Use Case ${useCase.name}`} disabled={busy} onClick={() => { if (window.confirm(`Xóa Use Case “${useCase.name}”?`)) void onDeleteUseCase(useCase.id); }} className="rounded px-1.5 py-1 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100">×</button>
                      </div>
                      <div className="ml-8 flex h-4 flex-nowrap items-center gap-1 overflow-x-auto">
                        {ucRelations.map((relation) => <span key={relation.id} className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-800">{relation.from}<button type="button" aria-label={`Bỏ liên kết ${relation.from} với ${useCase.name}`} disabled={busy} onClick={() => void onUnlinkActor(relation.id)} className="font-semibold hover:text-rose-600">×</button></span>)}
                        {linkingUseCaseId === useCase.id ? <form className="flex items-center gap-1" onSubmit={(event) => {
                          event.preventDefault(); const actorId = Number(linkActorId);
                          if (actorId > 0) void onLinkActor(useCase.id, actorId).then(() => { setLinkingUseCaseId(null); setLinkActorId(""); });
                        }}>
                          <select autoFocus aria-label="Chọn tác nhân liên kết" value={linkActorId} onChange={(event) => setLinkActorId(event.target.value)} className="h-6 max-w-28 rounded border border-slate-200 bg-white px-1 text-[10px]">
                            <option value="">Chọn Actor</option>
                            {actors.filter((actor) => !ucRelations.some((relation) => relation.actorId === actor.id)).map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
                          </select>
                          <button type="submit" disabled={busy || !linkActorId} className="text-xs font-semibold text-emerald-700 disabled:opacity-40">Lưu</button>
                          <button type="button" onClick={() => { setLinkingUseCaseId(null); setLinkActorId(""); }} className="text-xs text-slate-400">×</button>
                        </form> : <button type="button" disabled={busy || actors.length === 0} onClick={() => { setLinkingUseCaseId(useCase.id); setLinkActorId(""); }} className="text-[10px] text-slate-400 hover:text-emerald-700 disabled:opacity-40">+ liên kết</button>}
                      </div>
                    </div>;
                  })}
                </div>
                {specifications.length > 1 && <select value={newUseCaseSpecification || String(specifications[0]?.id ?? "")} onChange={(event) => setNewUseCaseSpecification(event.target.value)} aria-label="Đặc tả chức năng cho Use Case mới" className="mt-2 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs">
                  {specifications.map((item) => <option key={item.id} value={item.id}>{item.feature}</option>)}
                </select>}
                <form className="mt-1.5 flex gap-1.5" onSubmit={(event) => { event.preventDefault(); void createUseCase(); }}>
                  <input value={newUseCase} onChange={(event) => setNewUseCase(event.target.value)} disabled={busy || specifications.length === 0} placeholder="+ Thêm Use Case" aria-label="Tên Use Case mới" className="h-9 min-w-0 flex-1 rounded-lg border border-dashed border-slate-300 bg-white px-2 text-xs outline-none focus:border-emerald-500" />
                  <button type="submit" disabled={busy || !newUseCase.trim() || specifications.length === 0} className="h-9 rounded-lg bg-emerald-700 px-3 text-sm text-white disabled:opacity-40">+</button>
                </form>
              </section>
            </div>
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>{visibleRelations.length} liên kết Actor–Use Case</span><span>Enter lưu tên · Esc hủy</span>
      </div>
    </Card>
  );
}
