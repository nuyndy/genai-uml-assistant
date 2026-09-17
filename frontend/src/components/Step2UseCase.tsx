import { useState } from "react";

interface Specification {
  id: number;
  feature: string;
  type: "functional" | "non_functional";
  content: string;
}

interface UseCase {
  id: number;
  specId: number;
  name: string;
  mainFlow: string[];
  altFlows: string[];
  diagramGenerated: boolean;
}

export default function Step2UseCase({
  specs,
  onBack,
  onContinue,
}: {
  specs: Specification[];
  onBack: () => void;
  onContinue: (useCases: UseCase[]) => void;
}) {
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleGenerateUC = async (spec: Specification) => {
    setLoadingId(spec.id);
    // Placeholder — thay bằng call API thật: POST /generate-use-case
    await new Promise((r) => setTimeout(r, 600));
    const newUC: UseCase = {
      id: Date.now(),
      specId: spec.id,
      name: spec.feature,
      mainFlow: [
        "1. Người dùng thực hiện hành động chính.",
        "2. Hệ thống xử lý và trả kết quả.",
      ],
      altFlows: ["1a. Nếu lỗi xảy ra, hệ thống thông báo và yêu cầu thử lại."],
      diagramGenerated: false,
    };
    setUseCases([...useCases, newUC]);
    setExpandedId(newUC.id);
    setLoadingId(null);
  };

  const handleGenerateSequenceDiagram = async (ucId: number) => {
    setUseCases(
      useCases.map((uc) =>
        uc.id === ucId ? { ...uc, diagramGenerated: true } : uc
      )
    );
  };

  const updateFlowLine = (
    ucId: number,
    field: "mainFlow" | "altFlows",
    index: number,
    value: string
  ) => {
    setUseCases(
      useCases.map((uc) => {
        if (uc.id !== ucId) return uc;
        const updated = [...uc[field]];
        updated[index] = value;
        return { ...uc, [field]: updated };
      })
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div>
        <p className="text-sm font-medium text-violet-600 mb-1">Bước 2</p>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Kịch bản Use Case & biểu đồ tương tác
        </h1>
        <p className="mt-2 text-slate-500 leading-relaxed max-w-xl">
          Sinh kịch bản UC cho từng chức năng, chỉnh sửa nếu cần, sau đó sinh
          biểu đồ tương tác (sequence/collaboration) tương ứng.
        </p>
      </div>

      <div className="space-y-4">
        {specs.map((spec) => {
          const uc = useCases.find((u) => u.specId === spec.id);
          const isExpanded = uc && expandedId === uc.id;

          return (
            <div key={spec.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{spec.feature}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{spec.type === "functional" ? "Chức năng" : "Phi chức năng"}</p>
                </div>

                {!uc ? (
                  <button
                    type="button"
                    onClick={() => handleGenerateUC(spec)}
                    disabled={loadingId === spec.id}
                    className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
                  >
                    {loadingId === spec.id ? "Đang sinh..." : "Sinh kịch bản UC"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : uc.id)}
                    className="shrink-0 text-sm font-medium text-slate-500 hover:text-slate-700"
                  >
                    {isExpanded ? "Thu gọn ▲" : "Xem chi tiết ▼"}
                  </button>
                )}
              </div>

              {uc && isExpanded && (
                <div className="border-t border-slate-100 px-5 py-5 space-y-5 bg-slate-50/50">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                      Luồng chính
                    </p>
                    <div className="space-y-2">
                      {uc.mainFlow.map((line, i) => (
                        <input
                          key={i}
                          value={line}
                          onChange={(e) => updateFlowLine(uc.id, "mainFlow", i, e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                      Luồng phụ / Ngoại lệ
                    </p>
                    <div className="space-y-2">
                      {uc.altFlows.map((line, i) => (
                        <input
                          key={i}
                          value={line}
                          onChange={(e) => updateFlowLine(uc.id, "altFlows", i, e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    {uc.diagramGenerated ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                        ✓ Đã sinh biểu đồ tương tác
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleGenerateSequenceDiagram(uc.id)}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        Sinh biểu đồ tương tác (Sequence)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          ← Quay lại
        </button>
        <button
          type="button"
          disabled={useCases.length === 0}
          onClick={() => onContinue(useCases)}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Tiếp tục → Biểu đồ UC & lớp
        </button>
      </div>
    </div>
  );
}