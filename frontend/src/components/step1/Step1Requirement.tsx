import { useRef, useState } from "react";
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
import { saveRequirement } from "../../services/requirementService";

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
  // Bộ đếm id tăng dần (tránh gọi Date.now() trong lúc render — hàm không thuần).
  const nextId = useRef(1);

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

    const feature = form.action || "Chức năng mới";
    const record: RequirementRecord = {
      ...form,
      id: nextId.current++,
      feature,
      content: buildSpecification(form),
    };

    // Lưu lên backend (yêu cầu đăng nhập). Nếu chưa có project_id hoặc lỗi
    // mạng/phiên, vẫn giữ bản ghi cục bộ để không chặn luồng người dùng.
    if (projectId) {
      try {
        await saveRequirement({
          project_id: projectId,
          actor: form.actor,
          feature,
          benefit: form.purpose,
          precondition: null,
          constraint: null,
        });
        setNotice("Đã lưu yêu cầu lên máy chủ.");
      } catch (e) {
        setNotice(
          e instanceof Error
            ? `Chưa lưu được lên máy chủ (${e.message}). Đã lưu tạm trên trình duyệt.`
            : "Chưa lưu được lên máy chủ. Đã lưu tạm trên trình duyệt.",
        );
      }
    } else {
      setNotice("Đã lưu yêu cầu trên trình duyệt.");
    }

    setRecords((prev) => [...prev, record]);
    handleReset();
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
