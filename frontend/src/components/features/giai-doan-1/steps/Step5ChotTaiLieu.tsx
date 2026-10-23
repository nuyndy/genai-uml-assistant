import { useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  Card,
  EmptyState,
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
  projectName: string;
  srsMetadataDirty: boolean;
  srsMetadata: SrsMetadata;
  srsMarkdown: string;
  specifications: SpecificationRecord[];
  srsFunctionalForEditor: FunctionalRow[];
  srsNonFunctionalForEditor: NonFunctionalRow[];
  busy: boolean;
  onStepChange: (step: number) => void;
  saveSrsMetadataDraft: () => void | Promise<void>;
  onGenerateRemainingFields: () => void | Promise<void>;
  saveSrsSpecification: (record: SpecificationRecord, content: SpecDraft) => Promise<void>;
  setSrsMetadata: Dispatch<SetStateAction<SrsMetadata>>;
  setSrsSpecDrafts: Dispatch<SetStateAction<Record<number, SpecDraft>>>;
}

const SAVE_DEBOUNCE_MS = 800;

export default function Step5ChotTaiLieu({
  projectName,
  srsMetadataDirty,
  srsMetadata,
  srsMarkdown,
  specifications,
  srsFunctionalForEditor,
  srsNonFunctionalForEditor,
  busy,
  saveSrsMetadataDraft,
  onGenerateRemainingFields,
  saveSrsSpecification,
  setSrsMetadata,
  setSrsSpecDrafts,
}: Props) {
  // Mỗi đặc tả có một bộ đếm riêng: chỉ lưu sau khi người dùng ngừng sửa.
  const saveTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const editorRootRef = useRef<HTMLDivElement | null>(null);
  type TocItem = { label: string; target: string; level: 1 | 2 | 3 };
  const tocItems: TocItem[] = [
    { label: "1. Giới thiệu", target: "1. Giới thiệu", level: 1 },
    { label: "1.1 Mục đích", target: "1.1 Mục đích", level: 2 },
    { label: "1.2 Quy ước tài liệu", target: "1.2 Quy ước tài liệu", level: 2 },
    { label: "1.3 Đối tượng đọc và hướng dẫn đọc", target: "1.3 Đối tượng đọc và hướng dẫn đọc", level: 2 },
    { label: "1.4 Phạm vi sản phẩm", target: "1.4 Phạm vi sản phẩm", level: 2 },
    { label: "1.5 Tài liệu tham khảo", target: "1.5 Tài liệu tham khảo", level: 2 },
    { label: "1.6 Thuật ngữ và từ viết tắt", target: "1.6 Định nghĩa, thuật ngữ và từ viết tắt", level: 2 },
    { label: "2. Mô tả tổng thể", target: "2. Mô tả tổng thể", level: 1 },
    { label: "2.1 Góc nhìn sản phẩm", target: "2.1 Góc nhìn sản phẩm", level: 2 },
    { label: "2.2 Chức năng sản phẩm", target: "2.2 Chức năng sản phẩm", level: 2 },
    { label: "2.3 Các lớp người dùng", target: "2.3 Các lớp người dùng", level: 2 },
    { label: "2.4 Môi trường vận hành", target: "2.4 Môi trường vận hành", level: 2 },
    { label: "2.5 Ràng buộc thiết kế và triển khai", target: "2.5 Ràng buộc thiết kế và triển khai", level: 2 },
    { label: "2.6 Tài liệu hướng dẫn người dùng", target: "2.6 Tài liệu hướng dẫn người dùng", level: 2 },
    { label: "2.7 Giả định và phụ thuộc", target: "2.7 Giả định và phụ thuộc", level: 2 },
    { label: "3. Yêu cầu giao diện", target: "3. Yêu cầu giao diện", level: 1 },
    { label: "3.1 Giao diện người dùng", target: "3.1 Giao diện người dùng", level: 2 },
    { label: "3.2 Giao diện phần cứng", target: "3.2 Giao diện phần cứng", level: 2 },
    { label: "3.3 Giao diện phần mềm", target: "3.3 Giao diện phần mềm", level: 2 },
    { label: "3.4 Giao diện truyền thông", target: "3.4 Giao diện truyền thông", level: 2 },
    { label: "4. Yêu cầu chức năng", target: "4. Yêu cầu chức năng", level: 1 },
    { label: "4.1 Danh sách đặc tả chức năng", target: "4.1 Danh sách đặc tả chức năng", level: 2 },
    ...srsFunctionalForEditor.map((record) => ({
      label: `${record.value.function_code || "UC"} - ${record.value.function_name || record.feature || "Chức năng"}`,
      target: `${record.value.function_code || "UC"} - ${record.value.function_name || record.feature || "Chức năng"}`,
      level: 3 as const,
    })),
    { label: "5. Yêu cầu phi chức năng", target: "5. Yêu cầu phi chức năng", level: 1 },
    { label: "5.1 Danh sách đặc tả phi chức năng", target: "5.1 Danh sách đặc tả phi chức năng", level: 2 },
    ...srsNonFunctionalForEditor.map((record) => ({
      label: record.feature || "Đặc tả phi chức năng",
      target: record.feature || "Đặc tả phi chức năng",
      level: 3 as const,
    })),
    { label: "5.2 Quy tắc nghiệp vụ", target: "5.2 Quy tắc nghiệp vụ", level: 2 },
    { label: "6. Yêu cầu khác", target: "6. Yêu cầu khác", level: 1 },
    { label: "6.1 Yêu cầu khác / ghi chú", target: "6.1 Yêu cầu khác / ghi chú", level: 2 },
    { label: "Phụ lục A. Thuật ngữ", target: "Phụ lục A. Thuật ngữ và từ viết tắt", level: 1 },
    { label: "Phụ lục B. Mô hình phân tích", target: "Phụ lục B. Mô hình phân tích", level: 1 },
  ];

  const jumpToTocItem = (target: string) => {
    const root = editorRootRef.current;
    if (!root) return;
    const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
    const normalizedTarget = normalize(target);
    const candidates = Array.from(root.querySelectorAll<HTMLElement>("h2, h3, label"));
    const found = candidates.find((node) => {
      const text = normalize(node.innerText || node.textContent || "");
      return text === normalizedTarget || text.startsWith(normalizedTarget);
    });
    if (found) {
      found.scrollIntoView({ behavior: "smooth", block: "start" });
      found.classList.add("srs-toc-target");
      window.setTimeout(() => found.classList.remove("srs-toc-target"), 1400);
    }
  };


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
    <div className="w-full min-w-0 space-y-3">
      <Card compact allowOverflow tone="emerald">
        {srsMarkdown || specifications.length > 0 ? (
          <div className="grid h-[calc(100dvh-10.5rem)] min-h-0 min-w-0 grid-cols-1 gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside aria-label="Mục lục tài liệu SRS" className="z-30 flex h-full min-h-0 min-w-0 flex-col self-start rounded-xl border border-slate-200 bg-white p-2 shadow-sm xl:sticky xl:top-20">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900">Mục lục SRS</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">3 cấp</span>
              </div>
              <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" aria-label="Đi đến mục">
                {tocItems.map((item, index) => (
                  <button key={`${item.level}-${item.target}-${index}`} type="button" onClick={() => jumpToTocItem(item.target)} title={item.label}
                    className={`block w-full rounded-md px-1.5 py-1 text-left text-xs leading-4 transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-600 ${item.level === 1 ? "mt-1.5 border-b border-slate-100 font-bold text-slate-900" : item.level === 2 ? "pl-3 pr-1.5 font-medium text-slate-700" : "pl-5 pr-1.5 text-slate-500"}` }>
                    <span className="mr-1.5 text-[10px] text-slate-400">{item.level === 1 ? "▰" : item.level === 2 ? "•" : "↳"}</span>
                    <span className="break-words">{item.label}</span>
                  </button>
                ))}
              </nav>
              <div className="mt-2 grid shrink-0 grid-cols-2 gap-2 border-t border-slate-100 pt-2">
                <div className="min-w-0 [&>button]:w-full">
                  <SoftButton disabled={busy} onClick={() => void onGenerateRemainingFields()}>
                    Hoàn thiện SRS
                  </SoftButton>
                </div>
                <div className="min-w-0 [&>button]:w-full">
                  <SoftButton disabled={busy || !srsMetadataDirty} onClick={() => void saveSrsMetadataDraft()}>
                    Lưu SRS
                  </SoftButton>
                </div>
              </div>
              <p className="mt-1.5 shrink-0 text-[10px] leading-4 text-slate-400">Chọn một mục để cuộn đến đúng phần trong tài liệu.</p>
            </aside>
            <div ref={editorRootRef} className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain rounded-lg border border-slate-100 bg-slate-50/40 p-3 scroll-mt-4">
              <SrsWordEditor projectName={projectName} metadata={srsMetadata} functional={srsFunctionalForEditor} nonFunctional={srsNonFunctionalForEditor}
                onChangeMetadata={setSrsMetadata} onChangeSpecification={changeSpecification} />
            </div>
          </div>
        ) : (
          <EmptyState
            title="Tài liệu chưa có nội dung"
            hint="Hoàn thành đặc tả ở Bước 4 để soạn tài liệu."
          />
        )}
      </Card>
    </div>
  );
}