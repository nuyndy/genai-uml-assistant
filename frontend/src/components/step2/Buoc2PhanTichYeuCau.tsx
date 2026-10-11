import React from "react";
import {
  Card,
  EmptyState,
  PrimaryButton,
  SoftButton,
  StatusBadge,
  inputClass,
  wrapClass,
} from "../ui/primitives";
import type {
  RequirementRecord,
  RequirementAnalysis,
} from "../../types/workflow"; // adjust path as needed
import type { RawRequirement } from "../../types/workflow";

interface Props {
  draftRequirements: RequirementRecord[];
  loadingAnalysis: boolean;
  busy: boolean;
  analyses: Record<number, RequirementAnalysis>;
  requirementValues: Record<number, RawRequirement>;
  requirementTitle: (raw: RawRequirement) => string;
  runBatchAnalysis: () => void;
  onStepChange: (step: number) => void;
}

export default function Buoc2PhanTichYeuCau({
  draftRequirements,
  loadingAnalysis,
  busy,
  analyses,
  requirementValues,
  requirementTitle,
  runBatchAnalysis,
  onStepChange,
}: Props) {
  return (
    <Card
      tone="amber"
      title="Phân tích và phát hiện thiếu sót"
      actions={
        <SoftButton
          disabled={busy || loadingAnalysis || draftRequirements.length === 0}
          onClick={runBatchAnalysis}
        >
          Phân tích lại tất cả yêu cầu
        </SoftButton>
      }
    >
      {loadingAnalysis ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Đang phân tích {draftRequirements.length} yêu cầu...
        </p>
      ) : draftRequirements.length === 0 ? (
        <EmptyState
          title="Không có yêu cầu bản nháp"
          hint="Quay lại Bước 1 để thêm yêu cầu hoặc tiếp tục tới Bước 3."
        />
      ) : (
        <div className="space-y-4">
          {draftRequirements.map((item) => {
            const analysis = analyses[item.id];
            const rawValue = requirementValues[item.id];
            return (
              <article
                key={item.id}
                className="min-w-0 rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3
                    className={`min-w-0 flex-1 break-words text-sm font-semibold text-slate-900 ${wrapClass}`}
                  >
                    {rawValue
                      ? requirementTitle(rawValue)
                      : `Yêu cầu ${item.id}`}
                  </h3>
                  {analysis ? (
                    <StatusBadge
                      tone={analysis.is_complete ? "success" : "warn"}
                    >
                      {analysis.is_complete ? "Đủ" : "Thiếu"}
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="muted">Chưa có kết quả</StatusBadge>
                  )}
                </div>
                {analysis && !analysis.is_complete && (
                  <div className="mt-3 space-y-2 text-sm text-amber-900">
                    <ul className="list-disc space-y-1 pl-5">
                      {analysis.missing_elements.map((element) => (
                        <li key={element}>{element}</li>
                      ))}
                    </ul>
                    <p className={`rounded-lg bg-amber-50 p-3 ${wrapClass}`}>
                      {analysis.feedback}
                    </p>
                  </div>
                )}
                {analysis?.is_complete && (
                  <p
                    className={`mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 ${wrapClass}`}
                  >
                    {analysis.feedback ||
                      "Yêu cầu có đủ thông tin để tiếp tục."}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <PrimaryButton
          disabled={busy || loadingAnalysis}
          onClick={() => onStepChange(3)}
        >
          Tiếp tục sang Bước 3
        </PrimaryButton>
      </div>
    </Card>
  );
}
