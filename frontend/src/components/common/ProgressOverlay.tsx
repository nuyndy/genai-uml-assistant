import { useEffect, useState } from "react";

interface ProgressOverlayProps {
  label: string;
  estimate?: string;
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0
    ? `${minutes} phút ${String(remainingSeconds).padStart(2, "0")} giây`
    : `${remainingSeconds} giây`;
}

export default function ProgressOverlay({
  label,
}: ProgressOverlayProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

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
        <p className="mt-3 text-center text-xs text-slate-500" aria-live="off">
          Thời gian đã xử lý: {formatElapsed(elapsedSeconds)}
        </p>
      </div>
    </div>
  );
}
