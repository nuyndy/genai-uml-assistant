import { useMemo, useState } from "react";
import { Card, SoftButton } from "../../../common/ui/primitives";

interface ActorItem { id: number; name: string; description?: string; role?: string; mainBusinesses?: string }
interface UseCaseItem { id: number; name: string; description?: string; specificationId?: number }
interface SuggestedActor { token: string; name: string }
interface SuggestedUseCase { token: string; specification_id: number; name: string; description: string }
interface Suggestions { actors: SuggestedActor[]; useCases: SuggestedUseCase[] }
interface RelationItem { id: number; from: string; to: string; type: string }
interface SpecificationItem { id: number; feature: string }
interface Props {
  projectId?: number;
  onSaveActorDetails: (items: { id: number; description: string; role: string; mainBusinesses: string }[]) => Promise<void>;
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

const inputClass = "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50";
const fieldClass = "block w-full min-w-0 resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-5 text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white";

export default function Step1ActorUseCase({
  requirements: actors,
  requirementValues: useCases,
  relations,
  specifications,
  analyses: suggestions,
  loadingAnalysis,
  busy,
  runBatchAnalysis,
  onSaveSuggestions,
  onCreateActor,
  onRenameActor,
  onDeleteActor,
  onCreateUseCase,
  onRenameUseCase,
  onDeleteUseCase,
  onLinkActor,
  onUnlinkActor,
  onSaveActorDetails,
}: Props) {
  const [newActor, setNewActor] = useState("");
  const [newUseCase, setNewUseCase] = useState("");
  const [newUseCaseSpecification, setNewUseCaseSpecification] = useState("");
  const [linkingUseCaseId, setLinkingUseCaseId] = useState<number | null>(null);
  const [linkActorId, setLinkActorId] = useState("");
  const [actorDetails, setActorDetails] = useState<Record<number, { description: string; role: string; mainBusinesses: string }>>({});
  const hasSuggestions = suggestions.actors.length > 0 || suggestions.useCases.length > 0;
  const actorIdsByName = useMemo(() => new Map(actors.map((item) => [item.name, item.id])), [actors]);
  const useCaseIdsByName = useMemo(() => new Map(useCases.map((item) => [item.name, item.id])), [useCases]);
  const visibleRelations = useMemo(() => relations.flatMap((relation) => {
    const actorId = actorIdsByName.get(relation.from);
    const useCaseId = useCaseIdsByName.get(relation.to);
    return actorId !== undefined && useCaseId !== undefined ? [{ ...relation, actorId, useCaseId }] : [];
  }), [relations, actorIdsByName, useCaseIdsByName]);

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

  function actorValue(actor: ActorItem) {
    return actorDetails[actor.id] ?? {
      description: actor.description ?? "",
      role: actor.role ?? "",
      mainBusinesses: actor.mainBusinesses ?? "",
    };
  }

  function updateActorField(actor: ActorItem, field: "description" | "role" | "mainBusinesses", value: string) {
    setActorDetails((previous) => ({ ...previous, [actor.id]: { ...actorValue(actor), [field]: value } }));
  }

  return (
    <Card compact
      actions={<div className="flex w-full flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-600">
          <span className="font-semibold text-slate-800">{actors.length}</span> tác nhân
          <span className="mx-2 text-slate-300">·</span>
          <span className="font-semibold text-slate-800">{useCases.length}</span> Use Case
          <span className="mx-2 text-slate-300">·</span>
          <span className="font-semibold text-emerald-700">{visibleRelations.length}</span> liên kết
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SoftButton disabled={busy || loadingAnalysis} onClick={() => void runBatchAnalysis()}>
            {loadingAnalysis ? "Đang phân tích..." : hasSuggestions || actors.length ? "Phân tích lại bằng AI" : "Phân tích bằng AI"}
          </SoftButton>
          {hasSuggestions && <SoftButton disabled={busy || loadingAnalysis} onClick={() => void onSaveSuggestions()}>
            Thêm gợi ý ({suggestions.actors.length + suggestions.useCases.length})
          </SoftButton>}
        </div>
      </div>}
    >
      {loadingAnalysis && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Đang phân tích đặc tả chức năng...</p>}
      {hasSuggestions && <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
        <strong>Gợi ý chưa lưu</strong>
        <span>{suggestions.actors.length} tác nhân</span>
        <span>·</span>
        <span>{suggestions.useCases.length} Use Case</span>
        <span className="text-amber-800/80">Bấm “Thêm gợi ý” để lưu vào dự án.</span>
      </div>}

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.4fr)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Tác nhân</h3>
              <p className="mt-0.5 text-xs text-slate-500">Ai tương tác với hệ thống?</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{actors.length}</span>
          </div>
          <div className="flex flex-col gap-3 p-3">
            {actors.map((actor) => {
              const detail = actorValue(actor);
              const linkedUseCases = visibleRelations.filter((relation) => relation.actorId === actor.id);
              return <article key={actor.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex min-w-0 items-start gap-2">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <circle cx="12" cy="7" r="3.2" /><path d="M5.5 20v-1.8a6.5 6.5 0 0 1 13 0V20z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">Tên tác nhân</label>
                    <input aria-label="Tên tác nhân" key={`actor-${actor.id}-${actor.name}`} defaultValue={actor.name} disabled={busy} className={inputClass}
                      onBlur={(event) => { const name = event.currentTarget.value.trim(); if (name && name !== actor.name) void onRenameActor(actor.id, name); else if (!name) event.currentTarget.value = actor.name; }}
                      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { event.currentTarget.value = actor.name; event.currentTarget.blur(); } }} />
                  </div>
                  <button type="button" title="Xóa tác nhân" aria-label={`Xóa tác nhân ${actor.name}`} disabled={busy}
                    onClick={() => { if (window.confirm(`Xóa tác nhân “${actor.name}” và các liên kết liên quan?`)) void onDeleteActor(actor.id); }}
                    className="mt-5 shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40">Xóa</button>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="min-w-0 text-xs font-medium text-slate-600">Vai trò
                    <textarea rows={2} value={detail.role} disabled={busy} onChange={(event) => updateActorField(actor, "role", event.target.value)}
                      onBlur={() => void onSaveActorDetails([{ id: actor.id, ...actorValue(actor) }])} placeholder="Vai trò trong hệ thống…" className={`${fieldClass} mt-1`} />
                  </label>
                  <label className="min-w-0 text-xs font-medium text-slate-600">Mô tả
                    <textarea rows={2} value={detail.description} disabled={busy} onChange={(event) => updateActorField(actor, "description", event.target.value)}
                      onBlur={() => void onSaveActorDetails([{ id: actor.id, ...actorValue(actor) }])} placeholder="Mô tả ngắn…" className={`${fieldClass} mt-1`} />
                  </label>
                </div>
                <label className="mt-2 block text-xs font-medium text-slate-600">Nghiệp vụ chính
                  <textarea rows={2} value={detail.mainBusinesses} disabled={busy} onChange={(event) => updateActorField(actor, "mainBusinesses", event.target.value)}
                    onBlur={() => void onSaveActorDetails([{ id: actor.id, ...actorValue(actor) }])} placeholder="Các nghiệp vụ tác nhân thực hiện…" className={`${fieldClass} mt-1`} />
                </label>
                <div className="mt-3 border-t border-slate-100 pt-2.5">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Use Case tham gia</p>
                  {linkedUseCases.length ? <div className="flex flex-wrap gap-1.5">
                    {linkedUseCases.map((relation) => <span key={relation.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs text-sky-800">
                      <span className="truncate">{relation.to}</span>
                      <button type="button" title="Bỏ liên kết" aria-label={`Bỏ liên kết ${actor.name} với ${relation.to}`} disabled={busy} onClick={() => void onUnlinkActor(relation.id)} className="font-semibold text-sky-600 hover:text-rose-600">×</button>
                    </span>)}
                  </div> : <p className="text-xs italic text-slate-400">Chưa liên kết với Use Case nào</p>}
                </div>
              </article>;
            })}
            {actors.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-700">Chưa có tác nhân</p>
              <p className="mt-1 text-xs text-slate-500">Thêm tác nhân hoặc dùng AI để phân tích.</p>
            </div>}
            <form className="flex min-w-0 gap-2 rounded-xl border border-dashed border-emerald-300 bg-white p-2.5" onSubmit={(event) => { event.preventDefault(); void createActor(); }}>
              <input value={newActor} onChange={(event) => setNewActor(event.target.value)} disabled={busy} placeholder="Tên tác nhân mới…" aria-label="Tên tác nhân mới" className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500" />
              <button type="submit" disabled={busy || !newActor.trim()} className="shrink-0 rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white disabled:opacity-40">+ Thêm</button>
            </form>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Use Case</h3>
              <p className="mt-0.5 text-xs text-slate-500">Hệ thống cung cấp chức năng nào và tác nhân nào tham gia?</p>
            </div>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">{useCases.length}</span>
          </div>
          <div className="flex flex-col gap-3 p-3">
            {useCases.map((useCase, index) => {
              const ucRelations = visibleRelations.filter((relation) => relation.useCaseId === useCase.id);
              const availableActors = actors.filter((actor) => !ucRelations.some((relation) => relation.actorId === actor.id));
              return <article key={useCase.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex min-w-0 items-start gap-2">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <ellipse cx="12" cy="12" rx="9" ry="5.5" /><path d="M7 12h10" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">Use Case {index + 1}</label>
                    <input aria-label="Tên Use Case" key={`uc-${useCase.id}-${useCase.name}`} defaultValue={useCase.name} disabled={busy} className={inputClass}
                      onBlur={(event) => { const name = event.currentTarget.value.trim(); if (name && name !== useCase.name) void onRenameUseCase(useCase.id, name); else if (!name) event.currentTarget.value = useCase.name; }}
                      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { event.currentTarget.value = useCase.name; event.currentTarget.blur(); } }} />
                  </div>
                  <button type="button" title="Xóa Use Case" aria-label={`Xóa Use Case ${useCase.name}`} disabled={busy}
                    onClick={() => { if (window.confirm(`Xóa Use Case “${useCase.name}”?`)) void onDeleteUseCase(useCase.id); }}
                    className="mt-5 shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40">Xóa</button>
                </div>
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-700">Tác nhân tham gia</p>
                    <span className="text-[11px] text-slate-500">{ucRelations.length} liên kết</span>
                  </div>
                  {ucRelations.length ? <div className="flex flex-wrap gap-2">
                    {ucRelations.map((relation) => <span key={relation.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
                      <span aria-hidden="true">●</span><span className="truncate">{relation.from}</span>
                      <button type="button" title="Bỏ liên kết" aria-label={`Bỏ liên kết ${relation.from} với ${useCase.name}`} disabled={busy} onClick={() => void onUnlinkActor(relation.id)} className="ml-0.5 font-semibold text-emerald-700 hover:text-rose-600">×</button>
                    </span>)}
                  </div> : <p className="text-xs text-slate-400">Chưa có tác nhân liên kết. Thêm liên kết để thể hiện ai thực hiện chức năng này.</p>}
                  {linkingUseCaseId === useCase.id ? <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={(event) => {
                    event.preventDefault();
                    const actorId = Number(linkActorId);
                    if (actorId > 0) void onLinkActor(useCase.id, actorId).then(() => { setLinkingUseCaseId(null); setLinkActorId(""); });
                  }}>
                    <select autoFocus aria-label="Chọn tác nhân để liên kết" value={linkActorId} onChange={(event) => setLinkActorId(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm">
                      <option value="">Chọn tác nhân…</option>
                      {availableActors.map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
                    </select>
                    <button type="submit" disabled={busy || !linkActorId} className="h-9 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white disabled:opacity-40">Tạo liên kết</button>
                    <button type="button" onClick={() => { setLinkingUseCaseId(null); setLinkActorId(""); }} className="h-9 rounded-lg px-2 text-xs text-slate-500 hover:bg-slate-200">Hủy</button>
                  </form> : <button type="button" disabled={busy || availableActors.length === 0} onClick={() => { setLinkingUseCaseId(useCase.id); setLinkActorId(""); }}
                    className="mt-2 rounded-lg border border-dashed border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40">
                    + Liên kết tác nhân
                  </button>}
                </div>
              </article>;
            })}
            {useCases.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-700">Chưa có Use Case</p>
              <p className="mt-1 text-xs text-slate-500">Phân tích đặc tả hoặc thêm Use Case mới.</p>
            </div>}
            <form className="grid min-w-0 grid-cols-1 gap-2 rounded-xl border border-dashed border-sky-300 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(160px,0.8fr)_auto]" onSubmit={(event) => { event.preventDefault(); void createUseCase(); }}>
              <input value={newUseCase} onChange={(event) => setNewUseCase(event.target.value)} disabled={busy || specifications.length === 0} placeholder="Tên Use Case mới…" aria-label="Tên Use Case mới" className="h-9 min-w-0 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500" />
              <select value={newUseCaseSpecification} onChange={(event) => setNewUseCaseSpecification(event.target.value)} disabled={busy || specifications.length === 0} aria-label="Đặc tả chức năng nguồn" className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-emerald-500">
                <option value="">Chọn đặc tả chức năng</option>
                {specifications.map((specification) => <option key={specification.id} value={specification.id}>{specification.feature}</option>)}
              </select>
              <button type="submit" disabled={busy || !newUseCase.trim() || specifications.length === 0} className="h-9 rounded-lg bg-sky-700 px-3 text-sm font-medium text-white disabled:opacity-40">+ Thêm</button>
              {specifications.length === 0 && <p className="text-xs text-amber-700 sm:col-span-3">Cần có đặc tả chức năng ở Giai đoạn 1 trước khi tạo Use Case.</p>}
            </form>
          </div>
        </section>
      </div>
    </Card>
  );
}
