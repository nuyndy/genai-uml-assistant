import { useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { Card, EmptyState, SoftButton } from "../../../common/ui/primitives";
import SrsWordEditor from "../../../SrsWordEditor";
import type { FunctionalSpecification, NonFunctionalSpecification, SrsMetadata, SpecificationRecord } from "../../../../services/requirementService";

interface Props {
  srsLoaded: boolean;
  srsMarkdown: string;
  srsSynced: boolean;
  busy: boolean;
  onSyncSrs: () => Promise<void>;
  stage3Message: string;
  state: any;
  projectName?: string;
  metadata?: SrsMetadata;
}

type TocItem = { label: string; id: string; level: 1 | 2 | 3 };

function TextTable({ headers, rows, emptyText }: { headers: string[]; rows: unknown[][]; emptyText: string }) {
  return (
    <div className="my-3 overflow-x-auto">
      <table className="w-full table-fixed border-collapse border border-slate-400 text-left text-[13px] leading-5">
        <thead><tr>{headers.map((header) => <th key={header} className="border border-slate-400 bg-slate-100 px-2 py-1.5 font-bold">{header}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="break-words whitespace-pre-wrap border border-slate-300 px-2 py-1.5 align-top">{String(cell ?? "—") || "—"}</td>)}</tr>) : <tr><td colSpan={headers.length} className="border border-slate-300 px-2 py-3 text-slate-500 italic">{emptyText}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function DocumentHeading({ children, level = 2 }: { children: ReactNode; level?: 2 | 3 }) {
  return level === 2
    ? <h2 id={String(children).trim()} className="mb-3 mt-8 scroll-mt-4 text-center text-base font-bold uppercase tracking-wide text-slate-950 first:mt-0">{children}</h2>
    : <h3 id={String(children).trim()} className="mb-2 mt-5 scroll-mt-4 text-[15px] font-bold text-slate-900">{children}</h3>;
}

export default function Step1DongBoSRS({ srsLoaded, srsMarkdown, srsSynced, busy, onSyncSrs, stage3Message, state, projectName = "", metadata }: Props) {
  const documentRef = useRef<HTMLDivElement | null>(null);
  const actors = Array.isArray(state?.actors) ? state.actors : [];
  const useCases = Array.isArray(state?.useCases) ? state.useCases : [];
  const classes = Array.isArray(state?.umlClasses) ? state.umlClasses : [];
  const relations = Array.isArray(state?.relations) ? state.relations : [];
  const sequences = Array.isArray(state?.interactions) ? state.interactions : [];
  const diagramUrl = state?.useCaseDiagramUrl || state?.previewImageUrl || "";
  const srsMetadata: SrsMetadata = metadata ?? state?.srsMetadata ?? {
    intro_purpose: "", intro_scope: "", intro_definitions: "", overview_user_classes: "",
    overview_environment: "", appendix_notes: "",
  };
  const functional = (Array.isArray(state?.specs) ? state.specs : [])
    .filter((record: any) => record?.type === "functional")
    .map((record: SpecificationRecord & { value?: FunctionalSpecification }) => ({
      ...record,
      value: record.value ?? (() => { try { return JSON.parse(record.content) as FunctionalSpecification; } catch { return {} as FunctionalSpecification; } })(),
    }));
  const nonFunctional = (Array.isArray(state?.specs) ? state.specs : [])
    .filter((record: any) => record?.type === "non_functional")
    .map((record: SpecificationRecord & { value?: NonFunctionalSpecification }) => ({
      ...record,
      value: record.value ?? (() => { try { return JSON.parse(record.content) as NonFunctionalSpecification; } catch { return { items: [] }; } })(),
    }));
  const toc: TocItem[] = useMemo(() => [
    { label: "1. Giới thiệu", id: "1. Giới thiệu", level: 1 },
    { label: "1.1 Mục đích", id: "1.1 Mục đích", level: 2 },
    { label: "1.2 Quy ước tài liệu", id: "1.2 Quy ước tài liệu", level: 2 },
    { label: "1.3 Đối tượng đọc và hướng dẫn đọc", id: "1.3 Đối tượng đọc và hướng dẫn đọc", level: 2 },
    { label: "1.4 Phạm vi sản phẩm", id: "1.4 Phạm vi sản phẩm", level: 2 },
    { label: "1.5 Tài liệu tham khảo", id: "1.5 Tài liệu tham khảo", level: 2 },
    { label: "1.6 Thuật ngữ và từ viết tắt", id: "1.6 Định nghĩa, thuật ngữ và từ viết tắt", level: 2 },
    { label: "2. Mô tả tổng thể", id: "2. Mô tả tổng thể", level: 1 },
    { label: "2.1 Góc nhìn sản phẩm", id: "2.1 Góc nhìn sản phẩm", level: 2 },
    { label: "2.2 Chức năng sản phẩm", id: "2.2 Chức năng sản phẩm", level: 2 },
    { label: "2.3 Các lớp người dùng", id: "2.3 Các lớp người dùng", level: 2 },
    { label: "2.4 Môi trường vận hành", id: "2.4 Môi trường vận hành", level: 2 },
    { label: "2.5 Ràng buộc thiết kế và triển khai", id: "2.5 Ràng buộc thiết kế và triển khai", level: 2 },
    { label: "2.6 Tài liệu hướng dẫn người dùng", id: "2.6 Tài liệu hướng dẫn người dùng", level: 2 },
    { label: "2.7 Giả định và phụ thuộc", id: "2.7 Giả định và phụ thuộc", level: 2 },
    { label: "3. Yêu cầu giao diện", id: "3. Yêu cầu giao diện", level: 1 },
    { label: "3.1 Giao diện người dùng", id: "3.1 Giao diện người dùng", level: 2 },
    { label: "3.2 Giao diện phần cứng", id: "3.2 Giao diện phần cứng", level: 2 },
    { label: "3.3 Giao diện phần mềm", id: "3.3 Giao diện phần mềm", level: 2 },
    { label: "3.4 Giao diện truyền thông", id: "3.4 Giao diện truyền thông", level: 2 },
    { label: "4. Yêu cầu chức năng", id: "4. Yêu cầu chức năng", level: 1 },
    { label: "4.1 Danh sách đặc tả chức năng", id: "4.1 Danh sách đặc tả chức năng", level: 2 },
    ...functional.map((record: any) => ({
      label: `${record.value?.function_code || "UC"} - ${record.value?.function_name || record.feature || "Chức năng"}`,
      id: `${record.value?.function_code || "UC"} - ${record.value?.function_name || record.feature || "Chức năng"}`,
      level: 3 as const,
    })),
    { label: "5. Yêu cầu phi chức năng", id: "5. Yêu cầu phi chức năng", level: 1 },
    { label: "5.1 Danh sách đặc tả phi chức năng", id: "5.1 Danh sách đặc tả phi chức năng", level: 2 },
    ...nonFunctional.map((record: any) => ({ label: record.feature || "Đặc tả phi chức năng", id: record.feature || "Đặc tả phi chức năng", level: 3 as const })),
    { label: "5.2 Quy tắc nghiệp vụ", id: "5.2 Quy tắc nghiệp vụ", level: 2 },
    { label: "6. Yêu cầu khác", id: "6. Yêu cầu khác", level: 1 },
    { label: "6.1 Yêu cầu khác / ghi chú", id: "6.1 Yêu cầu khác / ghi chú", level: 2 },
    { label: "Phụ lục A. Thuật ngữ", id: "Phụ lục A. Thuật ngữ và từ viết tắt", level: 1 },
    { label: "Phụ lục B. Mô hình phân tích", id: "Phụ lục B. Mô hình phân tích", level: 1 },
    { label: "1. Mô hình hóa chức năng", id: "1. Mô hình hóa chức năng", level: 2 },
    { label: "1.1 Danh sách tác nhân", id: "1.1 Danh sách tác nhân", level: 3 },
    { label: "1.2 Biểu đồ Use Case tổng quan", id: "1.2 Biểu đồ Use Case tổng quan", level: 3 },
    ...useCases.map((uc: any, i: number) => ({ label: `1.2.${i + 1} ${uc?.name || uc?.title || `Use Case ${i + 1}`}`, id: `uc-${i}`, level: 3 as const })),
    { label: "2. Mô hình hóa cấu trúc", id: "2. Mô hình hóa cấu trúc", level: 2 },
    { label: "2.1 Biểu đồ lớp", id: "2.1 Biểu đồ lớp", level: 3 },
    { label: "2.2 Mô tả lớp và quan hệ", id: "2.2 Mô tả lớp và quan hệ", level: 3 },
    { label: "3. Mô hình hóa hành vi", id: "3. Mô hình hóa hành vi", level: 2 },
    { label: "3.1 Biểu đồ tuần tự", id: "3.1 Biểu đồ tuần tự", level: 3 },
  ], [functional, nonFunctional, useCases]);

  const jumpTo = (id: string) => {
    const root = documentRef.current;
    const target = root?.querySelector<HTMLElement>(`[data-doc-id="${CSS.escape(id)}"]`) ?? root?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const val = (item: any, ...keys: string[]) => {
    for (const key of keys) if (item?.[key] !== undefined && item?.[key] !== null) return Array.isArray(item[key]) ? item[key].join(", ") : String(item[key]);
    return "—";
  };
  const useCaseRows = useCases.map((uc: any, i: number) => [i + 1, val(uc, "name", "title", "use_case_name"), val(uc, "actors", "actor", "actorName")]);
  const classRows = classes.map((item: any, i: number) => [i + 1, val(item, "name", "class_name"), val(item, "attributes", "fields"), val(item, "methods", "operations")]);
  const relationRows = relations.map((item: any, i: number) => [i + 1, val(item, "source", "from", "sourceClass"), val(item, "target", "to", "targetClass"), val(item, "type", "relationType", "name")]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
      <Card compact allowOverflow tone="emerald" className="flex h-full min-h-0 flex-1 flex-col">
        {srsLoaded ? (
          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside aria-label="Mục lục tài liệu SRS" className="z-30 flex h-full min-h-0 min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900">Mục lục SRS</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">3 cấp</span>
              </div>
              <nav className="min-h-0 flex-1 space-y-1 overflow-y-scroll pr-1" aria-label="Đi đến mục">
                {toc.map((item, index) => <button key={`${item.level}-${item.id}-${index}`} type="button" onClick={() => jumpTo(item.id)} title={item.label}
                  className={`block w-full rounded-md px-1.5 py-1 text-left text-xs leading-4 transition hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-600 ${item.level === 1 ? "mt-1.5 border-b border-slate-100 font-bold text-slate-900" : item.level === 2 ? "pl-3 pr-1.5 font-medium text-slate-700" : "pl-5 pr-1.5 text-slate-500"}`}>
                  <span className="mr-1.5 text-[10px] text-slate-400">{item.level === 1 ? "▰" : item.level === 2 ? "•" : "↳"}</span>
                  <span className="break-words">{item.label}</span>
                </button>)}
              </nav>
              <div className="mt-2 grid shrink-0 grid-cols-2 gap-2 border-t border-slate-100 pt-2">
                <div className="min-w-0 [&>button]:w-full">
                  <SoftButton disabled={busy} onClick={() => void onSyncSrs()}>
                    {busy ? "Đang tải..." : "Đồng bộ SRS"}
                  </SoftButton>
                </div>
                <div className="min-w-0 [&>button]:w-full">
                  <SoftButton disabled={busy || !srsLoaded} onClick={() => void onSyncSrs()}>
                    Lưu / cập nhật
                  </SoftButton>
                </div>
              </div>
              <p className="mt-1.5 shrink-0 text-[10px] leading-4 text-slate-400">Chọn một mục để cuộn đến đúng phần trong tài liệu.</p>
            </aside>
            <div ref={documentRef} className="h-full min-h-0 min-w-0 overflow-y-scroll overscroll-contain rounded-lg border border-slate-100 bg-slate-50/40 p-3 scroll-mt-4">
              <SrsWordEditor
                projectName={projectName}
                metadata={srsMetadata}
                functional={functional}
                nonFunctional={nonFunctional}
                onChangeMetadata={() => undefined}
                onChangeSpecification={() => undefined}
                appendixBContent={
                  <div className="text-[15px] text-slate-900">
                    <DocumentHeading level={3}>1. Mô hình hóa chức năng</DocumentHeading>
                    <DocumentHeading level={3}>1.1 Danh sách tác nhân</DocumentHeading>
                    <TextTable headers={["STT", "Tên tác nhân", "Mô tả tác nhân", "Vai trò", "Các nghiệp vụ chính"]} rows={actors.map((a: any, i: number) => [i + 1, val(a, "name", "actorName", "title"), val(a, "description"), val(a, "role"), val(a, "useCases", "mainActivities", "activities")])} emptyText="Chưa có dữ liệu tác nhân được lưu." />
                    <DocumentHeading level={3}>1.2 Biểu đồ Use Case tổng quan</DocumentHeading>
                    <TextTable headers={["STT", "Tên Use Case", "Tác nhân"]} rows={useCaseRows} emptyText="Chưa có Use Case được lưu." />
                    {diagramUrl && <figure className="my-4 text-center"><img src={diagramUrl} alt="Biểu đồ Use Case tổng quan" className="mx-auto max-h-[560px] max-w-full object-contain" /><figcaption className="mt-2 text-xs">Hình B.1. Biểu đồ Use Case tổng quan</figcaption></figure>}
                    {useCases.map((uc: any, i: number) => <section key={uc?.id ?? i} data-doc-id={`uc-${i}`} className="break-inside-avoid">
                      <DocumentHeading level={3}>{`1.2.${i + 1} ${val(uc, "name", "title", "use_case_name")}`}</DocumentHeading>
                      <p className="mb-2 text-sm font-bold">a. Biểu đồ Use Case</p>
                      {uc?.diagramUrl || uc?.diagram_url ? <img src={uc.diagramUrl || uc.diagram_url} alt={`Biểu đồ Use Case ${i + 1}`} className="mx-auto my-3 max-h-[480px] max-w-full object-contain" /> : <p className="text-sm italic text-slate-500">Chưa có ảnh biểu đồ Use Case.</p>}
                      <p className="mb-2 text-sm font-bold">b. Biểu đồ hoạt động</p>
                      {uc?.activityDiagramUrl || uc?.activity_diagram_url ? <img src={uc.activityDiagramUrl || uc.activity_diagram_url} alt={`Biểu đồ hoạt động ${i + 1}`} className="mx-auto my-3 max-h-[480px] max-w-full object-contain" /> : <p className="text-sm italic text-slate-500">Chưa có ảnh biểu đồ hoạt động.</p>}
                      <p className="mb-2 text-sm font-bold">c. Kịch bản Use Case</p>
                      <TextTable headers={["Trường", "Nội dung"]} rows={[["Tên Use Case", val(uc, "name", "title", "use_case_name")], ["Tác nhân chính", val(uc, "primaryActor", "primary_actor", "actor")], ["Mô tả", val(uc, "description")], ["Tiền điều kiện", val(uc, "preconditions", "pre_conditions")], ["Đảm bảo tối thiểu", val(uc, "minimalGuarantees", "minimal_guarantee")], ["Hậu điều kiện", val(uc, "postconditions", "post_conditions")], ["Luồng chính", val(uc, "mainFlow", "main_flow", "steps")], ["Ngoại lệ", val(uc, "exceptions", "exception_flows", "alternative_flows")]]} emptyText="Chưa có kịch bản Use Case." />
                    </section>)}
                    <DocumentHeading level={3}>2. Mô hình hóa cấu trúc</DocumentHeading>
                    <DocumentHeading level={3}>2.1 Biểu đồ lớp</DocumentHeading>
                    {state?.previewImageUrl && <img src={state.previewImageUrl} alt="Biểu đồ lớp UML" className="mx-auto my-3 max-h-[560px] max-w-full object-contain" />}
                    <DocumentHeading level={3}>2.2 Mô tả lớp và quan hệ</DocumentHeading>
                    <TextTable headers={["STT", "Tên lớp", "Thuộc tính", "Phương thức"]} rows={classRows} emptyText="Chưa có dữ liệu lớp được lưu." />
                    <TextTable headers={["STT", "Lớp nguồn", "Lớp đích", "Quan hệ"]} rows={relationRows} emptyText="Chưa có quan hệ lớp được lưu." />
                    <DocumentHeading level={3}>3. Mô hình hóa hành vi</DocumentHeading>
                    <DocumentHeading level={3}>3.1 Biểu đồ tuần tự</DocumentHeading>
                    {sequences.length ? sequences.map((seq: any, i: number) => <section key={seq?.id ?? i} className="my-4 break-inside-avoid"><h4 className="mb-2 text-sm font-bold">{`3.1.${i + 1} ${val(seq, "name", "title", "useCaseName")}`}</h4>{(seq?.imageUrl || seq?.image_url || seq?.diagramUrl) ? <img src={seq.imageUrl || seq.image_url || seq.diagramUrl} alt={`Biểu đồ tuần tự ${i + 1}`} className="mx-auto max-h-[560px] max-w-full object-contain" /> : <pre className="whitespace-pre-wrap break-words rounded border border-slate-200 p-3 text-xs">{val(seq, "source_code", "code", "description")}</pre>}</section>) : <p className="text-sm italic text-slate-500">Chưa có biểu đồ tuần tự được lưu.</p>}
                  </div>
                }
              />
            </div>
          </div>
        ) : (
          <EmptyState title="Tài liệu chưa có nội dung" hint="Tải hoặc đồng bộ SRS để mở trình soạn thảo." />
        )}
      </Card>
    </div>
  );
}
