import { inputClass, type RequirementInput } from "./types";

interface Props {
  value: RequirementInput;
  onChange: (field: keyof RequirementInput, value: string) => void;
  preConditions?: string[];
  businessRules?: string[];
  onChangeList?: (field: "preConditions" | "businessRules", value: string[]) => void;
  onCheck: () => void;
  error: string;
  checkLabel?: string;
  disabled?: boolean;
}

/** Cột trái: form nhập các thành phần cốt lõi của yêu cầu. */
export default function RequirementFormFields({
  value,
  onChange,
  preConditions,
  businessRules,
  onChangeList,
  onCheck,
  error,
  checkLabel = "Kiểm tra cấu trúc yêu cầu",
  disabled = false,
}: Props) {
  return (
    <div className="bg-white rounded-2xl border-slate-200 p-6 space-y-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
        Thông tin Yêu cầu Đầu vào
      </h2>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Vai trò (Actor) <span className="text-violet-500">*</span>
        </label>
        <input
          value={value.actor}
          disabled={disabled}
          onChange={(e) => onChange("actor", e.target.value)}
          placeholder="VD: Sinh viên, Khách hàng"
          className={inputClass}
        />
      </div>

      {preConditions && businessRules && onChangeList && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Điều kiện trước
            </label>
            <textarea
              value={preConditions.join("\n")}
              disabled={disabled}
              onChange={(event) =>
                onChangeList(
                  "preConditions",
                  event.target.value.split("\n").map((item) => item.trim()).filter(Boolean),
                )
              }
              rows={3}
              placeholder="Mỗi điều kiện trên một dòng"
              className={`${inputClass} resize-y`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Quy tắc nghiệp vụ
            </label>
            <textarea
              value={businessRules.join("\n")}
              disabled={disabled}
              onChange={(event) =>
                onChangeList(
                  "businessRules",
                  event.target.value.split("\n").map((item) => item.trim()).filter(Boolean),
                )
              }
              rows={3}
              placeholder="Mỗi quy tắc trên một dòng"
              className={`${inputClass} resize-y`}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Hành động <span className="text-violet-500">*</span>
          </label>
          <input
            value={value.action}
            disabled={disabled}
            onChange={(e) => onChange("action", e.target.value)}
            placeholder="VD: Đăng ký, Thanh toán"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Đối tượng <span className="text-violet-500">*</span>
          </label>
          <input
            value={value.targetObject}
            disabled={disabled}
            onChange={(e) => onChange("targetObject", e.target.value)}
            placeholder="VD: Học phần, Đơn hàng"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Mục đích <span className="text-violet-500">*</span>
        </label>
        <input
          value={value.purpose}
          disabled={disabled}
          onChange={(e) => onChange("purpose", e.target.value)}
          placeholder="VD: Tự động hóa quy trình, Tiết kiệm thời gian"
          className={inputClass}
        />
      </div>

      {error && (
        <div className="rounded-xl border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onCheck}
        disabled={disabled}
        className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {checkLabel}
      </button>
    </div>
  );
}
