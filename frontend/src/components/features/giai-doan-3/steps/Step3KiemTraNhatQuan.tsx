import React from "react";
import { Card, SoftButton, GhostButton, PrimaryButton } from "../../../common/ui/primitives";

interface Props {
  state: {
    previewImageUrl: string | null;
    diagramCode: string;
  };
  busy: boolean;
  onRenderAndSave: () => Promise<void>;
  onStepChange: (step: number) => void;
}

export default function Step3KiemTraNhatQuan({
  state,
  busy,
  onRenderAndSave,
  onStepChange,
}: Props) {
  return (
    <div className="space-y-6">
      <Card
        tone="violet"
        title="Xem trước và hiển thị"
        actions={
          <SoftButton
            disabled={busy}
            onClick={onRenderAndSave}
          >
            {busy ? "Đang render..." : "Render và xem trước"}
          </SoftButton>
        }
      >
        <div className="relative min-h-[400px] flex items-center justify-center border rounded-xl bg-slate-50 overflow-hidden">
          {state.previewImageUrl ? (
            <img
              src={state.previewImageUrl}
              alt="Diagram Preview"
              className="max-w-full h-auto"
            />
          ) : (
            <div className="text-center p-8">
              <p className="text-sm text-slate-500">Chưa có ảnh xem trước</p>
              <p className="text-xs text-slate-400 mt-1">Bấm nút "Render và xem trước" để tạo ảnh từ mã hiện tại.</p>
            </div>
          )}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-slate-100 text-[10px] font-mono text-slate-500">
          Endpoint: POST /diagram/render
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <GhostButton onClick={() => onStepChange(1)}>
            ← Quay lại sửa thành phần
          </GhostButton>
          <GhostButton onClick={() => onStepChange(2)}>
            ← Quay lại sửa mã
          </GhostButton>
        </div>

        <PrimaryButton
          disabled={!state.previewImageUrl}
          onClick={() => onStepChange(4)}
        >
          Ưng ý, tiếp tục xuất →
        </PrimaryButton>
      </div>
    </div>
  );
}
