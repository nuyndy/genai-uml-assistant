import EditorModule from "react-simple-code-editor";
import type { ComponentType } from "react";
import { Card, PrimaryButton, SoftButton, StatusBadge } from "../../../common/ui/primitives";

const CodeEditor = (
  (
    EditorModule as unknown as {
      default?: ComponentType<any>;
    }
  ).default ?? EditorModule
) as ComponentType<any>;

interface Props {
  state: {
    actors: any[];
    usecases: any[];
    umlClasses: any[];
    relations: any[];
    diagramCode: string;
  };
  setState: (updater: (prev: any) => any) => void;
  onStepChange: (step: number) => void;
  wrapClass: string;
  singleLineClass: string;
  nextRelationId: number;
  nextClassId: number;
  consistencyResult: any;
  busy: boolean;
  onConsistencyCheck: () => Promise<void>;
}

export default function Step2ChinhSuaCapNhat({
  state,
  setState,
  wrapClass,
  singleLineClass,
  nextRelationId,
  nextClassId,
  consistencyResult,
  busy,
  onConsistencyCheck,
}: Props) {
  const RELATION_TYPES = ["association", "include", "extend", "generalization"];

  const buildCode = () => {
    const lines = ["@startuml", "left to right direction"];

    state.actors
      .filter((actor) => actor.name.trim())
      .forEach((actor) => {
        lines.push(`actor "${actor.name}" as ${actor.name.replace(/\s+/g, "_")}`);
      });

    state.usecases
      .filter((usecase) => usecase.name.trim())
      .forEach((usecase) => {
        lines.push(`usecase "${usecase.name}" as UC_${usecase.id}`);
      });

    state.relations
      .filter((relation) => relation.from.trim() && relation.to.trim())
      .forEach((relation) => {
        lines.push(`${relation.from.replace(/\s+/g, "_")} --> ${relation.to.replace(/\s+/g, "_")} : ${relation.type}`);
      });

    state.umlClasses
      .filter((umlClass) => umlClass.name.trim())
      .forEach((umlClass) => {
        lines.push(`class ${umlClass.name} {`);
        umlClass.attributes.forEach((attribute: string) => lines.push(`  ${attribute}`));
        umlClass.methods.forEach((method: string) => lines.push(`  ${method}`));
        lines.push("}");
      });

    lines.push("@enduml");
    return lines.join("\n");
  };

  const missingDb = consistencyResult?.missing_in_database ?? [];
  const missingPlantUml = consistencyResult?.missing_in_plantuml ?? [];
  const missingRelations = consistencyResult?.missing_relations ?? [];
  const extraRelations = consistencyResult?.extra_relations ?? [];
  const issues = [
    ...missingDb.map((item: string) => ({ type: "Thiếu trong dữ liệu", detail: item })),
    ...missingPlantUml.map((item: string) => ({ type: "Thiếu trong PlantUML", detail: item })),
    ...missingRelations.map((item: any) => ({ type: "Thiếu quan hệ", detail: `${item.from} → ${item.to} (${item.type})` })),
    ...extraRelations.map((item: any) => ({ type: "Quan hệ thừa", detail: `${item.from} → ${item.to} (${item.type})` })),
  ];

  return (
    <div className="space-y-6 pb-8">
      <Card
        tone="emerald"
        title="Khắc phục sai lệch UML"
        actions={
          <PrimaryButton disabled={busy || !state.diagramCode.trim()} onClick={onConsistencyCheck}>
            {busy ? "Đang kiểm tra..." : "Kiểm tra lại"}
          </PrimaryButton>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Các vấn đề dưới đây được lấy từ lần kiểm tra ở Bước 1. Chỉnh sửa dữ liệu hoặc mã PlantUML ở các mục bên dưới, sau đó chọn “Kiểm tra lại”.
          </p>
          {!consistencyResult ? (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              Chưa có kết quả từ Bước 1. Hãy quay lại Bước 1 và chạy kiểm tra trước khi khắc phục.
            </div>
          ) : issues.length === 0 ? (
            <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
              Không còn sai lệch theo kết quả kiểm tra gần nhất. Hãy kiểm tra lại để xác nhận thay đổi mới nhất.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="danger">{issues.length} sai lệch cần xử lý</StatusBadge>
                <StatusBadge tone="muted">Nguồn: Bước 1</StatusBadge>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-slate-50 p-3">
                {issues.map((issue: { type: string; detail: string }, index: number) => (
                  <div key={`${issue.type}-${index}`} className="rounded-lg border border-amber-100 bg-white p-3">
                    <p className="text-xs font-semibold text-amber-800">{issue.type}</p>
                    <p className="mt-1 break-words text-sm text-slate-700">{issue.detail}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Card>
      {/* Tác nhân */}
      <Card tone="emerald" title="Tác nhân">
        {state.actors.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">Chưa có tác nhân nào</div>
        ) : (
          <div className="space-y-2">
            {state.actors.map((actor, index) => (
              <div key={actor.id} className="flex items-center gap-2">
                <input
                  value={actor.name}
                  onChange={(e) =>
                    setState((prev: any) => ({
                      ...prev,
                      actors: prev.actors.map((a: any, i: number) => (i === index ? { ...a, name: e.target.value } : a)),
                    }))
                  }
                  className={singleLineClass}
                />
                <button
                  onClick={() =>
                    setState((prev: any) => ({
                      ...prev,
                      actors: prev.actors.filter((a: any) => a.id !== actor.id),
                    }))
                  }
                  className="text-xs text-rose-600 hover:underline"
                >
                  Xoá
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setState((prev: any) => ({
                  ...prev,
                  actors: [...prev.actors, { id: nextRelationId, name: "" }],
                }))
              }
              className="mt-2 text-xs text-emerald-600 hover:underline"
            >
              + Thêm tác nhân
            </button>
          </div>
        )}
      </Card>

      {/* Use case */}
      <Card tone="emerald" title="Use case">
        {state.usecases.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">Chưa có use case nào</div>
        ) : (
          <div className="space-y-2">
            {state.usecases.map((uc) => (
              <div key={uc.id} className="flex items-center gap-2">
                <input
                  value={uc.name}
                  onChange={(e) =>
                    setState((prev: any) => ({
                      ...prev,
                      usecases: prev.usecases.map((u: any) => (u.id === uc.id ? { ...u, name: e.target.value } : u)),
                    }))
                  }
                  className={singleLineClass}
                />
                <button
                  onClick={() =>
                    setState((prev: any) => ({
                      ...prev,
                      usecases: prev.usecases.filter((u: any) => u.id !== uc.id),
                    }))
                  }
                  className="text-xs text-rose-600 hover:underline"
                >
                  Xoá
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Lớp */}
      <Card tone="emerald" title="Lớp">
        {state.umlClasses.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">Chưa có lớp nào</div>
        ) : (
          <div className="space-y-4">
            {state.umlClasses.map((umlClass) => (
              <div key={umlClass.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    value={umlClass.name}
                    onChange={(e) =>
                      setState((prev: any) => ({
                        ...prev,
                        umlClasses: prev.umlClasses.map((c: any) => (c.id === umlClass.id ? { ...c, name: e.target.value } : c)),
                      }))
                    }
                    className={singleLineClass}
                  />
                  <button
                    onClick={() =>
                      setState((prev: any) => ({
                        ...prev,
                        umlClasses: prev.umlClasses.filter((c: any) => c.id !== umlClass.id),
                      }))
                    }
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Xoá
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-1">Thuộc tính</div>
                    <div className="space-y-1">
                      {umlClass.attributes.map((attr: string, i: number) => (
                        <div key={i} className="flex items-center gap-1">
                          <input
                            value={attr}
                            onChange={(e) =>
                              setState((prev: any) => ({
                                ...prev,
                                umlClasses: prev.umlClasses.map((c: any) =>
                                  c.id === umlClass.id
                                    ? { ...c, attributes: c.attributes.map((a: string, ai: number) => (ai === i ? e.target.value : a)) }
                                    : c,
                                ),
                              }))
                            }
                            className="text-xs p-1 border rounded w-full"
                          />
                        </div>
                      ))}
                      <button
                        onClick={() =>
                          setState((prev: any) => ({
                            ...prev,
                            umlClasses: prev.umlClasses.map((c: any) =>
                              c.id === umlClass.id ? { ...c, attributes: [...c.attributes, ""] } : c,
                            ),
                          }))
                        }
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        + Thêm
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-1">Phương thức</div>
                    <div className="space-y-1">
                      {umlClass.methods.map((method: string, i: number) => (
                        <div key={i} className="flex items-center gap-1">
                          <input
                            value={method}
                            onChange={(e) =>
                              setState((prev: any) => ({
                                ...prev,
                                umlClasses: prev.umlClasses.map((c: any) =>
                                  c.id === umlClass.id
                                    ? { ...c, methods: c.methods.map((m: string, mi: number) => (mi === i ? e.target.value : m)) }
                                    : c,
                                ),
                              }))
                            }
                            className="text-xs p-1 border rounded w-full"
                          />
                        </div>
                      ))}
                      <button
                        onClick={() =>
                          setState((prev: any) => ({
                            ...prev,
                            umlClasses: prev.umlClasses.map((c: any) =>
                              c.id === umlClass.id ? { ...c, methods: [...c.methods, ""] } : c,
                            ),
                          }))
                        }
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        + Thêm
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={() =>
                setState((prev: any) => ({
                  ...prev,
                  umlClasses: [...prev.umlClasses, { id: nextClassId, name: "", attributes: [], methods: [] }],
                }))
              }
              className="text-sm text-emerald-600 hover:underline"
            >
              + Thêm lớp
            </button>
          </div>
        )}
      </Card>

      {/* Quan hệ */}
      <Card tone="emerald" title="Quan hệ">
        {state.relations.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">Chưa có quan hệ nào</div>
        ) : (
          <div className="space-y-2">
            {state.relations.map((rel) => (
              <div key={rel.id} className="flex flex-wrap items-center gap-2">
                <input
                  value={rel.from}
                  onChange={(e) =>
                    setState((prev: any) => ({
                      ...prev,
                      relations: prev.relations.map((r: any) => (r.id === rel.id ? { ...r, from: e.target.value } : r)),
                    }))
                  }
                  className={singleLineClass}
                />
                <select
                  value={rel.type}
                  onChange={(e) =>
                    setState((prev: any) => ({
                      ...prev,
                      relations: prev.relations.map((r: any) => (r.id === rel.id ? { ...r, type: e.target.value } : r)),
                    }))
                  }
                  className={singleLineClass}
                >
                  {RELATION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input
                  value={rel.to}
                  onChange={(e) =>
                    setState((prev: any) => ({
                      ...prev,
                      relations: prev.relations.map((r: any) => (r.id === rel.id ? { ...r, to: e.target.value } : r)),
                    }))
                  }
                  className={singleLineClass}
                />
                <button
                  onClick={() =>
                    setState((prev: any) => ({
                      ...prev,
                      relations: prev.relations.filter((r: any) => r.id !== rel.id),
                    }))
                  }
                  className="text-xs text-rose-600 hover:underline"
                >
                  Xoá
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setState((prev: any) => ({
                  ...prev,
                  relations: [...prev.relations, { id: nextRelationId, from: "", to: "", type: "association" }],
                }))
              }
              className="mt-2 text-xs text-emerald-600 hover:underline"
            >
              + Thêm quan hệ
            </button>
          </div>
        )}
      </Card>

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
            onClick={() =>
              setState((prev: any) => ({
                ...prev,
                diagramCode: buildCode(),
              }))
            }
          >
            Sinh lại mã từ dữ liệu trên
          </SoftButton>
        </div>
        <div className="max-h-96 overflow-auto bg-slate-900 p-4">
          <CodeEditor
            value={state.diagramCode}
            onValueChange={(code: string) =>
              setState((prev: any) => ({
                ...prev,
                diagramCode: code,
              }))
            }
            highlight={(code: string) => code}
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
        
        
      </div>
    </div>
  );
}
