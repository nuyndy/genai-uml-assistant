import { useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  Card,
  EmptyState,
  GhostButton,
  PrimaryButton,
  SoftButton,
  StatusBadge,
} from "../../../common/ui/primitives";
import SrsWordEditor from "../../../SrsWordEditor";
import type {
  FunctionalSpecification,
  NonFunctionalSpecification,
  SpecificationRecord,
  SrsMetadata,
} from "../../../../services/requirementService";

type SpecDraft = FunctionalSpecification | NonFunctionalSpecification;

type FunctionalRow = SpecificationRecord & { value: FunctionalSpecification };
type NonFunctionalRow = SpecificationRecord & { value: NonFunctionalSpecification };

interface Props {
  srsMetadataDirty: boolean;
  srsMetadata: SrsMetadata;
  srsMarkdown: string;
  specifications: SpecificationRecord[];
  srsFunctionalForEditor: FunctionalRow[];
  srsNonFunctionalForEditor: NonFunctionalRow[];
  busy: boolean;
  onStepChange: (step: number) => void;
  saveSrsMetadataDraft: () => void | Promise<void>;
  exportSrs: () => void | Promise<void>;
  saveSrsSpecification: (record: SpecificationRecord, content: SpecDraft) => Promise<void>;
  setSrsMetadata: Dispatch<SetStateAction<SrsMetadata>>;
  setSrsSpecDrafts: Dispatch<SetStateAction<Record<number, SpecDraft>>>;
}

const SAVE_DEBOUNCE_MS = 800;

export default function Step5ChotTaiLieu({
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
}: Props) {
  // Mỗi đặc tả có một bộ đếm riêng: chỉ lưu sau khi người dùng ngừng sửa.
  const saveTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const changeSpecification = (record: SpecificationRecord, content: SpecDraft) => {
    setSrsSpecDrafts((previous) => ({ ...previous, [record.id]: content }));
    const pending = saveTimers.current.get(record.id);
    if (pending) clearTimeout(pending);
    saveTimers.current.set(
      record.id,
      setTimeout(() => {
        saveTimers.current.delete(record.id);
        void saveSrsSpecification(record, content);
      }, SAVE_DEBOUNCE_MS),
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {srsMetadataDirty && <StatusBadge tone="warn">Có thay đổi chưa lưu</StatusBadge>}
        <SoftButton
          disabled={busy || !srsMetadataDirty}
          onClick={() => void saveSrsMetadataDraft()}
        >
          Lưu phần giới thiệu
        </SoftButton>
        <PrimaryButton disabled={busy} onClick={() => void exportSrs()}>
          Tải xuống file Word (.docx)
        </PrimaryButton>
      </div>
      <Card
        tone="plain"
        title="Tài liệu SRS"
        actions={<StatusBadge tone="success">{specifications.length} mục</StatusBadge>}
      >
        {srsMarkdown || specifications.length > 0 ? (
          <SrsWordEditor
            metadata={srsMetadata}
            functional={srsFunctionalForEditor}
            nonFunctional={srsNonFunctionalForEditor}
            onChangeMetadata={setSrsMetadata}
            onChangeSpecification={changeSpecification}
          />
        ) : (
          <EmptyState
            title="Tài liệu chưa có nội dung"
            hint="Hoàn thành đặc tả ở Bước 4 để soạn tài liệu."
          />
        )}
      </Card>
      <div className="flex justify-start">
        <GhostButton onClick={() => onStepChange(4)}>Quay lại Bước 4</GhostButton>
      </div>
    </div>
  );
}