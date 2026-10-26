import { useState } from "react";
import type {
  RequirementInput,
  RequirementRecord,
  Specification,
  ValidationResult,
} from "./types";
import {
  validateRequirement,
  buildSpecification,
} from "./logic";
import RequirementFormFields from "./RequirementFormFields";
import ValidationCard from "./ValidationCard";
import EarsPreviewCard from "./EarsPreviewCard";
import ContextDiagramCard from "./ContextDiagramCard";
import RequirementsBoard from "./RequirementsBoard";
import { createRequirement } from "../../services/requirementService";

export type { Specification } from "./types";

const EMPTY_FORM: RequirementInput = {
  actor: "",
  action: "",
  targetObject: "",
  purpose: "",
};

export default function Step1Requirement({
  onContinue,
  projectId,
}: {
  onContinue: (specs: Specification[]) => void;
  projectId?: number;
}) {
  const [form, setForm] = useState<RequirementInput>(EMPTY_FORM);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [records, setRecords] = useState<RequirementRecord[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const handleChange = (field: keyof RequirementInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCheck = () => {
    const { actor, action, targetObject } = form;
    if (!actor.trim() || !action.trim() || !targetObject.trim()) {
      setError("Vui lòng điền đủ Vai trò, Hành động và Đối tượng.");
      setValidation(null);
      return;
    }
    setError("");
    setValidation(validateRequirement(form));
  };
  const handleSave = async () => {
    const result = validateRequirement(form);
    if (!result.isComplete) return;
    if (!projectId) {
      setError("Không thể lưu yêu cầu khi chưa có dự án trong cơ sở dữ liệu.");
      return;
    }

    const feature = `${form.action} ${form.targetObject}`.trim();
    try {
      const saved = await createRequirement(projectId, {
          actor: form.actor,
          action: form.action,
          target_object: form.targetObject,
          purpose: form.purpose,
          pre_conditions: [],
          business_rules: [],
      });
      const record: RequirementRecord = {
        ...form,
        id: saved.id,
        feature,
        content: buildSpecification(form),
      };
      setNotice("Đã lưu yêu cầu vào cơ sở dữ liệu.");
      setRecords((prev) => [...prev, record]);
      handleReset();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? `Không lưu được yêu cầu: ${reason.message}`
          : "Không lưu được yêu cầu.",
      );
    }
  };

  const handleRemove = (id: number) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setValidation(null);
    setError("");
  };

  const specsFromRecords: Specification[] = records.map((r) => ({
    id: r.id,
    feature: r.feature,
    type: "functional",
    content: r.content,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          1. Thu thập &amp; Chuẩn hóa Yêu cầu
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Nhập các thành phần cốt lõi; hệ thống kiểm tra cấu trúc và lưu lại mọi yêu cầu bạn nhập.
        </p>
      </div>

      {notice && (
        <div className="rounded-xl border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
          <RequirementFormFields
            value={form}
            onChange={handleChange}
            onCheck={handleCheck}
            error={error}
          />

          {validation && (
            <ValidationCard
              result={validation}
              onSave={handleSave}
              onReset={handleReset}
            />
          )}
        </div>
        <div className="space-y-6">
          <EarsPreviewCard value={form} />
          <ContextDiagramCard value={form} />
          <RequirementsBoard records={records} onRemove={handleRemove} />

          <div className="flex justify-end pt-4">
            <button
              type="button"
              disabled={specsFromRecords.length === 0}
              onClick={() => onContinue(specsFromRecords)}
              className="w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40 shadow-sm"
            >
              Sinh kịch bản UC
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
