import { useEffect, useState } from "react";

interface ProgressOverlayProps {
  label: string;
}

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} giờ ${String(minutes).padStart(2, "0")} phút ${String(seconds).padStart(2, "0")} giây`;
  }
  if (minutes > 0) {
    return `${minutes} phút ${String(seconds).padStart(2, "0")} giây`;
  }
  return `${seconds} giây`;
}

export default function ProgressOverlay({ label }: ProgressOverlayProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const updateElapsed = () => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    };

    setElapsedSeconds(0);
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);

    return () => window.clearInterval(timer);
  }, [label]);

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
