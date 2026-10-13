import { useState } from "react";
import Editor from "react-simple-code-editor";
import UmlCanvas from "./UmlCanvas";

interface UseCase {
  id: number;
  name: string;
}

type DiagramType = "use_case" | "class";

interface Actor {
  id: number;
  name: string;
}

interface Relation {
  id: number;
  from: string;
  to: string;
  type: string;
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100";

export default function Step3DiagramBuilder({
  useCases,
  onBack,
}: {
  useCases: UseCase[];
  onBack: () => void;
}) {
  const [diagramType, setDiagramType] = useState<DiagramType>("use_case");
  const [actors, setActors] = useState<Actor[]>([{ id: 1, name: "" }]);
  const [relations, setRelations] = useState<Relation[]>([
    { id: 1, from: "", to: "", type: "association" },
  ]);
  const [code, setCode] = useState(
    "@startuml\nactor Actor1\nusecase UC1\nActor1 --> UC1\n@enduml"
  );
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  const addActor = () => setActors([...actors, { id: Date.now(), name: "" }]);
  const updateActor = (id: number, name: string) =>
    setActors(actors.map((a) => (a.id === id ? { ...a, name } : a)));
  const removeActor = (id: number) => setActors(actors.filter((a) => a.id !== id));

  const addRelation = () =>
    setRelations([...relations, { id: Date.now(), from: "", to: "", type: "association" }]);
  const updateRelation = (id: number, field: keyof Relation, value: string) =>
    setRelations(relations.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const removeRelation = (id: number) => setRelations(relations.filter((r) => r.id !== id));

  const handleSuggest = () => {
    // Placeholder — gọi API gợi ý actor/UC/relation từ Gemini khi backend sẵn sàng
    const suggestedActors = useCases.length > 0 ? [{ id: Date.now(), name: "Người dùng" }] : [];
    setActors(suggestedActors.length ? suggestedActors : actors);
  };

  const buildCodeFromForm = () => {
    const lines = ["@startuml"];
    actors.filter((a) => a.name.trim()).forEach((a) => lines.push(`actor "${a.name}" as ${a.name.replace(/\s+/g, "_")}`));
    useCases.forEach((uc) => lines.push(`usecase "${uc.name}" as UC${uc.id}`));
    relations
      .filter((r) => r.from && r.to)
      .forEach((r) => lines.push(`${r.from} --> ${r.to} : ${r.type}`));
    lines.push("@enduml");
    setCode(lines.join("\n"));
  };

  const handleRender = async () => {
    setRendering(true);
    try {
      // Placeholder — gọi API render PlantUML thật: POST /render-diagram { source_code }
      await new Promise((r) => setTimeout(r, 800));
      setImageUrl(
        "data:image/svg+xml;utf8," +
          encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='200'><rect width='100%' height='100%' fill='%23f8fafc'/><text x='50%' y='50%' text-anchor='middle' fill='%2394a3b8' font-family='sans-serif' font-size='14'>Ảnh biểu đồ sẽ hiện ở đây</text></svg>`
          )
      );
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <div>
        <p className="text-sm font-medium text-violet-600 mb-1">Bước 3</p>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Biểu đồ Use Case & Lớp
        </h1>
        <p className="mt-2 text-slate-500 leading-relaxed max-w-xl">
          Nhập hoặc để hệ thống gợi ý tác nhân, UC và mối quan hệ. Mã biểu đồ
          được tạo tự động, bạn có thể chỉnh sửa trước khi xuất ảnh.
        </p>
      </div>

      {/* Chọn loại biểu đồ */}
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {(["use_case", "class"] as DiagramType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setDiagramType(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              diagramType === t ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t === "use_case" ? "Biểu đồ Use Case" : "Biểu đồ Lớp"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cột trái: nhập dữ liệu */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-slate-700">Tác nhân (Actor)</p>
              <button type="button" onClick={handleSuggest} className="text-xs font-medium text-violet-600 hover:text-violet-700">
                ✨ Gợi ý tự động
              </button>
            </div>
            <div className="space-y-2">
              {actors.map((a) => (
                <div key={a.id} className="flex items-center gap-2">
                  <input value={a.name} onChange={(e) => updateActor(a.id, e.target.value)} placeholder="VD: Khách hàng" className={inputClass} />
                  {actors.length > 1 && (
                    <button type="button" onClick={() => removeActor(a.id)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500">
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addActor} className="mt-3 text-sm font-medium text-violet-600 hover:text-violet-700">
              + Thêm tác nhân
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-700 mb-3">Mối quan hệ</p>
            <div className="space-y-2">
              {relations.map((r) => (
                <div key={r.id} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
                  <input value={r.from} onChange={(e) => updateRelation(r.id, "from", e.target.value)} placeholder="Từ" className={inputClass} />
                  <select value={r.type} onChange={(e) => updateRelation(r.id, "type", e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600 outline-none focus:border-violet-400">
                    <option value="association">association</option>
                    <option value="include">include</option>
                    <option value="extend">extend</option>
                    <option value="generalization">generalization</option>
                  </select>
                  <input value={r.to} onChange={(e) => updateRelation(r.id, "to", e.target.value)} placeholder="Đến" className={inputClass} />
                  <button type="button" onClick={() => removeRelation(r.id)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500">
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addRelation} className="mt-3 text-sm font-medium text-violet-600 hover:text-violet-700">
              + Thêm quan hệ
            </button>
          </div>

          <button
            type="button"
            onClick={buildCodeFromForm}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-700 transition hover:bg-violet-100"
          >
            Sinh mã từ dữ liệu trên
          </button>
        </div>

        {/* Cột phải: code editor + preview */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-medium text-slate-700">Mã mô tả biểu đồ (PlantUML)</p>
            </div>
            <div className="bg-slate-900 p-4 max-h-72 overflow-auto">
              <Editor
                value={code}
                onValueChange={setCode}
                highlight={(c) => c}
                padding={0}
                style={{
                  fontFamily: '"Fira Code", monospace',
                  fontSize: 13,
                  color: "#e2e8f0",
                  minHeight: "160px",
                }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRender}
            disabled={rendering}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {rendering ? "Đang render..." : "Xuất biểu đồ thành ảnh"}
          </button>

          <UmlCanvas projectId={0} sourceCode={code} onSourceChange={setCode} />
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          ← Quay lại
        </button>
      </div>
    </div>
  );
}