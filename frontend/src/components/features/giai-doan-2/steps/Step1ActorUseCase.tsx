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

const inputClass = "w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-slate-800 outline-none hover:border-slate-200 focus:border-emerald-500 focus:bg-white";
const textareaClass = "w-full min-w-0 resize-y rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-slate-700 outline-none hover:border-slate-200 focus:border-emerald-500 focus:bg-white";

export default function Step1ActorUseCase({
  requirements: actors, requirementValues: useCases, relations, specifications,
  analyses: suggestions, loadingAnalysis, busy, runBatchAnalysis, onSaveSuggestions,
  onCreateActor, onRenameActor, onDeleteActor, onCreateUseCase, onRenameUseCase,
  onDeleteUseCase, onLinkActor, onUnlinkActor, onSaveActorDetails,
}: Props) {
  const [newActor, setNewActor] = useState("");
  const [newUseCase, setNewUseCase] = useState("");
  const [newUseCaseSpecification, setNewUseCaseSpecification] = useState("");
  const [linkingUseCaseId, setLinkingUseCaseId] = useState<number | null>(null);
  const [linkActorId, setLinkActorId] = useState("");
  const [savingActorDetails, setSavingActorDetails] = useState(false);
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
    <Card compact title="Tác nhân & Use Case"
      actions={<div className="flex flex-wrap items-center justify-end gap-2">
        <SoftButton disabled={busy || loadingAnalysis} onClick={() => void runBatchAnalysis()}>
          {loadingAnalysis ? "Đang phân tích..." : hasSuggestions || actors.length ? "Phân tích lại bằng AI" : "Phân tích bằng AI"}
        </SoftButton>
        <button type="button" disabled={busy || savingActorDetails} onClick={() => {
          setSavingActorDetails(true);
          void onSaveActorDetails(actors.map((actor) => ({ id: actor.id, ...actorValue(actor) }))).finally(() => setSavingActorDetails(false));
        }} className="h-9 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
          {savingActorDetails ? "Đang lưu..." : "Lưu"}
        </button>
        {hasSuggestions && <SoftButton disabled={busy || loadingAnalysis} onClick={() => void onSaveSuggestions()}>
          Thêm gợi ý ({suggestions.actors.length + suggestions.useCases.length})
        </SoftButton>}
      </div>}
    >
      {loadingAnalysis && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Đang phân tích đặc tả chức năng...</p>}
      {hasSuggestions && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <strong>Gợi ý chưa lưu:</strong><span>{suggestions.actors.length} tác nhân</span><span>·</span><span>{suggestions.useCases.length} Use Case</span><span>Bấm “Thêm gợi ý” để lưu vào dự án.</span>
      </div>}

      <div className="grid h-[calc(100vh-285px)] min-h-[420px] grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
            <table className="w-full table-fixed border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-emerald-700 text-xs text-white"><tr>
                <th className="w-[23%] border-b border-emerald-600 px-2 py-3 font-semibold">Tên tác nhân</th>
                <th className="w-[24%] border-b px-1 py-3 font-semibold">Mô tả tác nhân</th>
                <th className="w-[18%] border-b px-1 py-3 font-semibold">Vai trò</th>
                <th className="border-b px-1 py-3 font-semibold">Các nghiệp vụ chính</th>
                <th className="w-16 border-b border-emerald-600 px-1 py-3"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {actors.map((actor, index) => {
                  const detail = actorValue(actor);
                  return <tr key={actor.id} className="align-top hover:bg-emerald-50/30">
                    <td className="px-2 py-2 text-xs text-slate-400">{index + 1}</td>
                    <td className="px-0.5 py-1"><input aria-label="Tên tác nhân" key={`actor-${actor.id}-${actor.name}`} defaultValue={actor.name} disabled={busy} className={inputClass}
                      onBlur={(event) => { const name = event.currentTarget.value.trim(); if (name && name !== actor.name) void onRenameActor(actor.id, name); else if (!name) event.currentTarget.value = actor.name; }}
                      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { event.currentTarget.value = actor.name; event.currentTarget.blur(); } }} /></td>
                    <td className="px-0.5 py-1"><textarea aria-label="Mô tả tác nhân" rows={2} value={detail.description} disabled={busy} onChange={(event) => updateActorField(actor, "description", event.target.value)} placeholder="Mô tả…" className={textareaClass} /></td>
                    <td className="px-0.5 py-1"><textarea aria-label="Vai trò tác nhân" rows={2} value={detail.role} disabled={busy} onChange={(event) => updateActorField(actor, "role", event.target.value)} placeholder="Vai trò…" className={textareaClass} /></td>
                    <td className="px-0.5 py-1"><textarea aria-label="Các nghiệp vụ chính" rows={2} value={detail.mainBusinesses} disabled={busy} onChange={(event) => updateActorField(actor, "mainBusinesses", event.target.value)} placeholder="Các nghiệp vụ…" className={textareaClass} /></td>
                    <td className="px-1 py-1 text-right"><button type="button" title="Xóa tác nhân" aria-label={`Xóa tác nhân ${actor.name}`} disabled={busy} onClick={() => { if (window.confirm(`Xóa tác nhân “${actor.name}” và các liên kết liên quan?`)) void onDeleteActor(actor.id); }} className="rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40">Xóa</button></td>
                  </tr>;
                })}
                {actors.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">Chưa có tác nhân. Thêm mới hoặc phân tích bằng AI.</td></tr>}
              </tbody>
            </table>
          </div>
          <form className="flex shrink-0 gap-2 border-t border-slate-200 bg-slate-50/70 p-3" onSubmit={(event) => { event.preventDefault(); void createActor(); }}>
            <input value={newActor} onChange={(event) => setNewActor(event.target.value)} disabled={busy} placeholder="Tên tác nhân mới…" aria-label="Tên tác nhân mới" className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500" />
            <button type="submit" disabled={busy || !newActor.trim()} className="h-9 shrink-0 rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white disabled:opacity-40">+ Thêm</button>
          </form>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
            <table className="w-full table-fixed border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-white text-xs text-slate-600"><tr>
                <th className="w-9 border-b border-emerald-600 px-2 py-3 font-semibold">#</th>
                <th className="border-b border-emerald-600 px-2 py-3 font-semibold">Tên Use Case</th>
                <th className="w-[34%] border-b px-2 py-3 font-semibold">Tác nhân</th>
                <th className="w-16 border-b px-1 py-3"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {useCases.map((useCase, index) => {
                  const ucRelations = visibleRelations.filter((item) => item.useCaseId === useCase.id);
                  return <tr key={useCase.id} className="align-top hover:bg-sky-50/30">
                    <td className="px-2 py-2 text-xs text-slate-400">{index + 1}</td>
                    <td className="px-1 py-1"><input aria-label="Tên usecase" key={`uc-${useCase.id}-${useCase.name}`} defaultValue={useCase.name} disabled={busy} className={inputClass}
                      onBlur={(event) => { const name = event.currentTarget.value.trim(); if (name && name !== useCase.name) void onRenameUseCase(useCase.id, name); else if (!name) event.currentTarget.value = useCase.name; }}
                      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { event.currentTarget.value = useCase.name; event.currentTarget.blur(); } }} /></td>
                    <td className="px-1 py-1">
                      <div className="flex flex-wrap items-center gap-1">
                        {ucRelations.map((relation) => <span key={relation.id} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-800">{relation.from}<button type="button" aria-label={`Bỏ liên kết ${relation.from} với ${useCase.name}`} disabled={busy} onClick={() => void onUnlinkActor(relation.id)} className="font-semibold hover:text-rose-600">×</button></span>)}
                        {linkingUseCaseId === useCase.id ? <form className="flex flex-wrap items-center gap-1" onSubmit={(event) => {
                          event.preventDefault(); const actorId = Number(linkActorId);
                          if (actorId > 0) void onLinkActor(useCase.id, actorId).then(() => { setLinkingUseCaseId(null); setLinkActorId(""); });
                        }}>
                          <select autoFocus aria-label="Chọn tác nhân" value={linkActorId} onChange={(event) => setLinkActorId(event.target.value)} className="h-7 max-w-36 rounded border border-slate-200 bg-white px-1 text-xs">
                            <option value="">Chọn tác nhân</option>
                            {actors.filter((actor) => !ucRelations.some((relation) => relation.actorId === actor.id)).map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
                          </select>
                          <button type="submit" disabled={busy || !linkActorId} className="text-xs font-semibold text-emerald-700 disabled:opacity-40">Lưu</button>
                          <button type="button" onClick={() => { setLinkingUseCaseId(null); setLinkActorId(""); }} className="text-xs text-slate-400">Hủy</button>
                        </form> : <button type="button" disabled={busy || actors.length === 0} onClick={() => { setLinkingUseCaseId(useCase.id); setLinkActorId(""); }} className="rounded px-1 py-0.5 text-[10px] text-slate-500 hover:bg-slate-100 hover:text-emerald-700 disabled:opacity-40">+ Gắn</button>}
                      </div>
                    </td>
                    <td className="px-1 py-1 text-right"><button type="button" title="Xóa Use Case" aria-label={`Xóa Use Case ${useCase.name}`} disabled={busy} onClick={() => { if (window.confirm(`Xóa Use Case “${useCase.name}”?`)) void onDeleteUseCase(useCase.id); }} className="rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40">Xóa</button></td>
                  </tr>;
                })}
                {useCases.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-xs text-slate-400">Chưa có Use Case.</td></tr>}
              </tbody>
            </table>
          </div>
          <form className="flex shrink-0 gap-2 border-t border-slate-200 bg-slate-50/70 p-3" onSubmit={(event) => { event.preventDefault(); void createUseCase(); }}>
            <input value={newUseCase} onChange={(event) => setNewUseCase(event.target.value)} disabled={busy || specifications.length === 0} placeholder="Tên usecase mới…" aria-label="Tên usecase mới" className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500" />
            <button type="submit" disabled={busy || !newUseCase.trim() || specifications.length === 0} className="h-9 shrink-0 rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white disabled:opacity-40">+ Thêm</button>
          </form>
        </section>
      </div>
    </Card>
  );
}
