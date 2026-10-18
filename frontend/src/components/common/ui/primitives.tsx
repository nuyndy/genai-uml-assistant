import type { ReactNode } from "react";

/**
 * Lớp style dùng chung cho input/textarea/select.
 * Giữ đúng design system: nền slate-50, viền slate-200, focus:ring-4 ring-emerald-100.
 */
export const inputClass =
  "w-full min-w-0 rounded-lg border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100";

/** Ô nhập 1 dòng: chiều cao cố định để các ô cùng hàng thẳng nhau. */
export const singleLineClass = `${inputClass} h-10`;

/** Bảo đảm chữ không tràn khung: xuống dòng ở mọi ký tự. */
export const wrapClass = "break-words [overflow-wrap:anywhere]";

/** Cắt gọn 1 dòng kèm dấu "...". */
export const truncateClass = "truncate min-w-0";

/** Nhịp cách chuẩn: 24px giữa các khối. */
export const stackGap = "space-y-6";

/** Chiều cao chuẩn cho mọi nút cùng cấp. */
const BTN_H = "h-11";

/**
 * Nền trang trí: gradient tím rất nhạt + lưới mờ + quầng sáng, giúp bố cục
 * bớt phẳng với tông xanh lá và kem.
 */
export function StageBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/80 via-white to-amber-50/50" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(16,185,129,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(139,92,246,0.07) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-emerald-200/25 blur-3xl" />
      <div className="absolute -bottom-32 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
    </div>
  );
}

/**
 * Card nền trắng cho mọi khối: bo góc, viền mảnh, đổ bóng để tạo độ sâu,
 * padding 24px đồng nhất và chữ tự xuống dòng để không tràn khung.
 */
export function Card({
  title,
  subtitle,
  actions,
  tone = "plain",
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  tone?: "plain" | "emerald" | "amber" | "rose";
  children: ReactNode;
}) {
  const accent = {
    plain: "",
    emerald: "border-l-4 border-l-emerald-500",
    amber: "border-l-4 border-l-amber-400",
    rose: "border-l-4 border-l-rose-400",
  }[tone];

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border-slate-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md ${accent}`}
    >
      {(title || actions) && (
        <div className="mb-5 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {title && (
              <h3
                className={`text-sm font-semibold text-slate-900 ${wrapClass}`}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p className={`mt-1 text-xs text-slate-500 ${wrapClass}`}>
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/** Nút chính (emerald). */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex ${BTN_H} items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none`}
    >
      {children}
    </button>
  );
}

/** Nút phụ (emerald nhạt), dùng cho hành động gọi AI. */
export function SoftButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex ${BTN_H} items-center justify-center gap-2 whitespace-nowrap rounded-xl border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

/** Nút phụ (xám). */
export function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex ${BTN_H} items-center justify-center gap-2 whitespace-nowrap rounded-xl border-slate-200 bg-white px-5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

/** Nút nhỏ, cùng chiều cao chuẩn, dùng cho thao tác trong danh sách. */
export function MiniButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex ${BTN_H} shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

/** Nút xoá dòng, vuông vắn, không đổi chiều cao khi hover. */
export function RemoveButton({
  onClick,
  label = "Xoá dòng",
  disabled = false,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex ${BTN_H} w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40`}
    >
      ✕
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Badge trạng thái                                                     */
/* ------------------------------------------------------------------ */

export type StatusTone = "success" | "warn" | "danger" | "info" | "muted";

const STATUS_STYLE: Record<StatusTone, string> = {
  success: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  warn: "bg-amber-100 text-amber-800 ring-amber-200",
  danger: "bg-rose-100 text-rose-700 ring-rose-200",
  info: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  muted: "bg-slate-100 text-slate-600 ring-slate-200",
};

const STATUS_DOT: Record<StatusTone, string> = {
  success: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-emerald-500",
  muted: "bg-slate-400",
};

/** Badge trạng thái có chấm màu, tự co giãn, chữ không tràn. */
export function StatusBadge({
  tone = "muted",
  children,
}: {
  tone?: StatusTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${STATUS_STYLE[tone]}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[tone]}`}
      />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Badge phân loại đặc tả: chức năng (emerald) và phi chức năng (amber). */
export function SpecBadge({ type }: { type: "functional" | "non_functional" }) {
  return type === "functional" ? (
    <StatusBadge tone="info">Chức năng</StatusBadge>
  ) : (
    <StatusBadge tone="warn">Phi chức năng</StatusBadge>
  );
}

/* ------------------------------------------------------------------ */
/* Trạng thái rỗng                                                      */
/* ------------------------------------------------------------------ */

/**
 * Trạng thái rỗng: icon mờ kèm một câu hướng dẫn ngắn, thay cho khoảng
 * trống trắng gây khó hiểu.
 */
export function EmptyState({
  icon = "◌",
  title,
  hint,
}: {
  icon?: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center">
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl text-slate-300 shadow-sm"
      >
        {icon}
      </span>
      <p className={`text-sm font-medium text-slate-500 ${wrapClass}`}>
        {title}
      </p>
      {hint && (
        <p className={`max-w-sm text-xs text-slate-400 ${wrapClass}`}>{hint}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Danh sách                                                            */
/* ------------------------------------------------------------------ */

/** Bảng xanh lá cho "Thành phần đã đủ". */
export function CompleteList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon="○"
        title="Chưa xác định được thành phần nào"
        hint="Chạy phân tích để hệ thống đối chiếu yêu cầu."
      />
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item}
          className={`flex items-start gap-2.5 rounded-lg border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 shadow-sm ${wrapClass}`}
        >
          <span aria-hidden="true" className="font-semibold text-emerald-600">
            ✓
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Danh sách vàng cho "Thành phần còn thiếu" kèm gợi ý bổ sung. */
export function MissingList({
  items,
}: {
  items: { element: string; suggestion: string }[];
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon="✓"
        title="Không còn thành phần thiếu"
        hint="Yêu cầu đã đủ 4 thành phần cốt lõi."
      />
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.element}
          className={`rounded-lg border-amber-200 bg-amber-50 px-3 py-2.5 shadow-sm ${wrapClass}`}
        >
          <p className="flex items-start gap-2.5 text-sm font-medium text-amber-900">
            <span aria-hidden="true" className="font-semibold text-amber-600">
              ⚠
            </span>
            <span className="min-w-0">{item.element}</span>
          </p>
          <p className={`mt-1 pl-6 text-xs text-amber-700 ${wrapClass}`}>
            Gợi ý: {item.suggestion}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Nhãn nhóm nhỏ dùng làm đầu các khối con. */
export function FieldLabel({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-2 flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {children}
      </span>
      {hint && <StatusBadge tone="muted">{hint}</StatusBadge>}
    </div>
  );
}

/**
 * Danh sách input có nút thêm/xoá, mỗi dòng cao bằng nhau và chữ tự xuống dòng.
 */
export function StringListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
  canDelete = true,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  canDelete?: boolean;
}) {
  return (
    <div className="space-y-2">
      {items.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={value}
            placeholder={placeholder}
            onChange={(e) =>
              onChange(items.map((v, i) => (i === index ? e.target.value : v)))
            }
            className={singleLineClass}
          />
          {canDelete && items.length > 1 && (
            <RemoveButton
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="inline-flex h-9 items-center gap-1 rounded-lg px-1 text-sm font-medium text-emerald-600 transition hover:text-emerald-800"
      >
        {addLabel ?? "+ Thêm"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Khung xem trước                                                      */
/* ------------------------------------------------------------------ */

/** Khung xem trước ảnh biểu đồ kèm nút tải ảnh; có trạng thái rỗng rõ ràng. */
export function DiagramPreview({
  imageUrl,
  emptyTitle,
  emptyHint,
  downloadName,
}: {
  imageUrl: string | null;
  emptyTitle: string;
  emptyHint?: string;
  downloadName?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-medium text-slate-700">Xem trước</p>
        {imageUrl && downloadName && (
          <a
            href={imageUrl}
            download={downloadName}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-700"
          >
            ⬇ Tải ảnh về
          </a>
        )}
      </div>
      <div className="flex min-h-[240px] items-center justify-center bg-slate-50/70 p-4">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Biểu đồ"
            className="max-w-full rounded-lg shadow-sm"
          />
        ) : (
          <EmptyState icon="▣" title={emptyTitle} hint={emptyHint} />
        )}
      </div>
    </div>
  );
}

/** Ghi chú endpoint đang là placeholder, gọn và đồng nhất trên mọi màn hình. */
export function PlaceholderNote({ endpoint }: { endpoint: string }) {
  return (
    <p
      className={`mt-3 text-[11px] leading-relaxed text-slate-400 ${wrapClass}`}
    >
      Đang chờ backend: <code className="text-slate-500">{endpoint}</code>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Thông báo                                                            */
/* ------------------------------------------------------------------ */

/** Hộp thông báo trạng thái, có viền trái nhấn màu. */
export function Notice({
  tone = "info",
  icon,
  children,
}: {
  tone?: "info" | "success" | "warn" | "danger";
  icon?: string;
  children: ReactNode;
}) {
  const style = {
    info: "border-sky-200 border-l-emerald-500 bg-sky-50 text-sky-800",
    success:
      "border-emerald-200 border-l-emerald-500 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 border-l-amber-400 bg-amber-50 text-amber-900",
    danger: "border-rose-200 border-l-rose-500 bg-rose-50 text-rose-800",
  }[tone];
  const fallback = {
    info: "ℹ",
    success: "✓",
    warn: "⚠",
    danger: "✕",
  }[tone];

  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-sm ${wrapClass} ${style}`}
    >
      <span aria-hidden="true" className="shrink-0 font-semibold">
        {icon ?? fallback}
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tiêu đề bước                                                         */
/* ------------------------------------------------------------------ */

/** Tiêu đề bước. Chữ tự xuống dòng, không tràn khung ở màn hình hẹp. */
export function StepHeading({
  step,
  title,
  description,
  icon,
}: {
  step: string;
  title: string;
  description?: string;
  icon?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {icon && (
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base text-emerald-700 shadow-sm"
          >
            {icon}
          </span>
        )}
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
          {step}
        </p>
      </div>
      <h2
        className={`mt-1.5 text-xl font-semibold tracking-tight text-slate-900 ${wrapClass}`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-1.5 max-w-2xl leading-relaxed text-slate-500 ${wrapClass}`}
        >
          {description}
        </p>
      )}
    </div>
  );
}

/** Bộ chuyển trạng thái dạng pill, các nút cùng chiều cao. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border-slate-200 bg-white p-1 shadow-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-medium transition ${
            value === o.value
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
