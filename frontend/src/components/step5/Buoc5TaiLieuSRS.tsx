import React from "react";
import {
  Card,
  EmptyState,
  GhostButton,
  PrimaryButton,
  SoftButton,
  StatusBadge,
  wrapClass,
} from "../ui/primitives";
import SrsWordEditor from "../SrsWordEditor";

export default function Buoc5TaiLieuSRS({
  srsMetadataDirty,
  srsMetadata,
  srsMarkdown,
  specifications,
  srsFunctionalForEditor,
  srsNonFunctionalForEditor,
  busy,
  onStepChange,
  saveSrsMetadataDraft,
  exportSrs,
  saveSrsSpecification,
  setSrsMetadata,
  setSrsSpecDrafts,
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {srsMetadataDirty && (
          <StatusBadge tone="warn">Có thay đổi chưa lưu</StatusBadge>
        )}
        <SoftButton
          disabled={busy || !srsMetadataDirty}
          onClick={saveSrsMetadataDraft}
        >
          Lưu phần giới thiệu
        </SoftButton>
        <PrimaryButton disabled={busy} onClick={exportSrs}>
          Tải xuống file Word (.docx)
        </PrimaryButton>
      </div>
      <Card
        tone="plain"
        title="Tài liệu SRS"
        actions={
          <StatusBadge tone="success">{specifications.length} mục</StatusBadge>
        }
      >
        {srsMarkdown || specifications.length > 0 ? (
          <SrsWordEditor
            metadata={srsMetadata}
            functional={srsFunctionalForEditor}
            nonFunctional={srsNonFunctionalForEditor}
            onChangeMetadata={setSrsMetadata}
            onChangeSpecification={(record, content) => {
              setSrsSpecDrafts((prev) => ({ ...prev, [record.id]: content }));
              void saveSrsSpecification(record, content);
            }}
          />
        ) : (
          <EmptyState
            title="Tài liệu chưa có nội dung"
            hint="Hoàn thành đặc tả ở Bước 4 để soạn tài liệu."
          />
        )}
      </Card>
      <div className="flex justify-start">
        <GhostButton onClick={() => onStepChange(4)}>
          Quay lại Bước 4
        </GhostButton>
      </div>
    </div>
  );
}
