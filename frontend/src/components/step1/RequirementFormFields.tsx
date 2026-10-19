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

/** Biểu mẫu nhập yêu cầu theo cấu trúc Actor – Action – Object – Purpose. */
export default function RequirementFormFields({
  value,
  onChange,
  preConditions,
  businessRules,
  onChangeList,
  onCheck,
  error,
  checkLabel = "Thêm yêu cầu",
  disabled = false,
}: Props) {
  return (
    <div className="space-y-5">

      <div>
        <label htmlFor="requirement-actor" className="mb-1.5 block text-sm font-medium text-slate-700">
          Vai trò (Actor) <span className="text-rose-600">*</span>
        </label>
        <input
          id="requirement-actor"
          value={value.actor}
          disabled={disabled}
          onChange={(event) => onChange("actor", event.target.value)}
          placeholder="Ví dụ: Sinh viên, Quản trị viên, Khách hàng"
          className={inputClass}
          autoComplete="off"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="requirement-action" className="mb-1.5 block text-sm font-medium text-slate-700">
            Hành động <span className="text-rose-600">*</span>
          </label>
          <input
            id="requirement-action"
            value={value.action}
            disabled={disabled}
            onChange={(event) => onChange("action", event.target.value)}
            placeholder="Ví dụ: Đăng ký, Thanh toán"
            className={inputClass}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="requirement-target" className="mb-1.5 block text-sm font-medium text-slate-700">
            Đối tượng <span className="text-rose-600">*</span>
          </label>
          <input
            id="requirement-target"
            value={value.targetObject}
            disabled={disabled}
            onChange={(event) => onChange("targetObject", event.target.value)}
            placeholder="Ví dụ: Học phần, Đơn hàng"
            className={inputClass}
            autoComplete="off"
          />
        </div>
      </div>

      <div>
        <label htmlFor="requirement-purpose" className="mb-1.5 block text-sm font-medium text-slate-700">
          Mục đích <span className="text-rose-600">*</span>
        </label>
        <input
          id="requirement-purpose"
          value={value.purpose}
          disabled={disabled}
          onChange={(event) => onChange("purpose", event.target.value)}
          placeholder="Ví dụ: Theo dõi tiến độ, tiết kiệm thời gian"
          className={inputClass}
          autoComplete="off"
        />
      </div>

      {preConditions && businessRules && onChangeList && (
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Thông tin bổ sung (không bắt buộc)</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="requirement-preconditions" className="mb-1.5 block text-sm font-medium text-slate-700">
                Điều kiện trước
              </label>
              <textarea
                id="requirement-preconditions"
                value={preConditions.join("\n")}
                disabled={disabled}
                onChange={(event) => onChangeList("preConditions", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))}
                rows={3}
                placeholder="Ví dụ: Người dùng đã đăng nhập"
                className={`${inputClass} resize-y`}
              />
            </div>
            <div>
              <label htmlFor="requirement-business-rules" className="mb-1.5 block text-sm font-medium text-slate-700">
                Quy tắc nghiệp vụ
              </label>
              <textarea
                id="requirement-business-rules"
                value={businessRules.join("\n")}
                disabled={disabled}
                onChange={(event) => onChangeList("businessRules", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))}
                rows={3}
                placeholder="Ví dụ: Mỗi tài khoản chỉ được đặt một lịch cùng thời điểm"
                className={`${inputClass} resize-y`}
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onCheck}
        disabled={disabled}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {checkLabel}
      </button>
    </div>
  );
}
