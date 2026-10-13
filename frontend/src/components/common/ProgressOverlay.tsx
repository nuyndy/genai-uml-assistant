interface ProgressOverlayProps {
  label: string;
  estimate?: string;
}

export default function ProgressOverlay({
  label,
  estimate = "Thường mất 5-15 giây",
}: ProgressOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/70 p-4 backdrop-blur-[2px]"
      role="alert"
      aria-live="assertive"
      aria-label={label}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <p className="mb-4 text-center text-sm font-semibold text-slate-800">{label}</p>
        <div
          className="h-2 overflow-hidden rounded-full bg-violet-100"
          role="progressbar"
          aria-label="Đang xử lý"
        >
          <div className="h-full w-[38%] rounded-full bg-violet-600 progress-indeterminate" />
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">{estimate}</p>
      </div>
    </div>
  );
}
