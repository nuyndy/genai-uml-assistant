import { useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  Card,
  EmptyState,
  GhostButton,
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
    <div className="w-full min-w-0 space-y-5">
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3"><p className="text-xs text-slate-500">Tổng đặc tả</p><p className="mt-1 text-xl font-semibold text-slate-900">{specifications.length}</p></div>
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3"><p className="text-xs text-slate-500">Đặc tả chức năng</p><p className="mt-1 text-xl font-semibold text-slate-900">{srsFunctionalForEditor.length}</p></div>
          <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3"><p className="text-xs text-slate-500">Đặc tả phi chức năng</p><p className="mt-1 text-xl font-semibold text-slate-900">{srsNonFunctionalForEditor.length}</p></div>
        </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {srsMetadataDirty ? <StatusBadge tone="warn">Phần giới thiệu có thay đổi</StatusBadge> : <StatusBadge tone="success">Phần giới thiệu đã lưu</StatusBadge> }
          <span className="text-xs text-slate-500">Các thay đổi đặc tả được lưu tự động sau khi ngừng nhập.</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SoftButton disabled={busy || !srsMetadataDirty} onClick={() => void saveSrsMetadataDraft()}>Lưu phần giới thiệu</SoftButton>
        </div>
      </div>
      <Card
        tone="emerald"
        title="Bản xem và chỉnh sửa tài liệu SRS"
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div><p className="text-sm font-semibold text-slate-900">Chưa chốt tài liệu</p><p className="mt-1 text-xs text-slate-700">Bước này chỉ rà soát và đồng bộ bản nháp. Việc duyệt baseline và xuất file chính thức thuộc Giai đoạn 3.</p></div>
        
      </div>
    </div>
  );
}