import React from "react";
import { Card, SegmentedControl, SoftButton, Notice, PrimaryButton, GhostButton } from "../../../common/ui/primitives";

interface Props {
  state: {
    exportFormat: string;
    previewImageUrl: string | null;
    embeddedDiagrams: { name: string; imageUrl: string }[];
  };
  busy: boolean;
  onAttachDiagram: () => Promise<void>;
  onStepChange: (step: number) => void;
}

export default function Step4DuyetBaselineXuatTaiLieu({
  state,
  busy,
  onAttachDiagram,
  onStepChange,
}: Props) {
  return (
    <div className="space-y-6">
      <Card tone="violet" title="Định dạng xuất">
        <SegmentedControl<string>
          value={state.exportFormat}
          onChange={(format) => {
            // This should be handled by coordinator via a prop function
            // But for now we are keeping the props minimal.
            // In GiaiDoan3.tsx, we'll handle the state update.
          }}
          options={[
            { value: "png", label: "PNG" },
            { value: "svg", label: "SVG" },
          ]}
        />
      </Card>

      {state.previewImageUrl ? (
        <div className="relative min-h-[400px] flex items-center justify-center border rounded-xl bg-slate-50 overflow-hidden">
           <img
              src={state.previewImageUrl}
              alt="Final Diagram"
              className="max-w-full h-auto"
            />
        </div>
      ) : (
        <Notice tone="warn">
          Chưa có ảnh biểu đồ để xuất. Hãy quay lại Bước 3 để render trước khi xuất.
        </Notice>
      )}

      <Card
        tone="emerald"
        title="Xuất kết quả"
        actions={
          state.embeddedDiagrams.length > 0 ? (
            <div className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-medium">
              Đã chèn {state.embeddedDiagrams.length} biểu đồ
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-wrap gap-3">
          {state.previewImageUrl && (
            <a
              href={state.previewImageUrl}
              download={`diagram.${state.exportFormat}`}
              className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-violet-600 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 hover:shadow-md"
            >
              ⬇ Xuất file ảnh (.{state.exportFormat})
            </a>
          )}

          <SoftButton
            disabled={!state.previewImageUrl || busy}
            onClick={onAttachDiagram}
          >
            Chèn vào tài liệu đặc tả hệ thống
          </SoftButton>
        </div>

        {!state.previewImageUrl && (
          <p className="mt-3 text-xs text-slate-500">
            Nút xuất sẽ khả dụng sau khi có ảnh ở Bước 3.
          </p>
        )}

        <div className="mt-4 p-3 rounded-lg bg-slate-100 text-[10px] font-mono text-slate-500">
          Endpoint: POST /diagram/export và POST /specs/attach-diagram
        </div>
      </Card>

      <div className="flex flex-wrap justify-between gap-3">
        <GhostButton onClick={() => onStepChange(3)}>
          ← Quay lại sửa mã
        </GhostButton>
      </div>
    </div>
  );
}
