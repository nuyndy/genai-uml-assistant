import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import type {
  FunctionalSpecification,
  NonFunctionalSpecification,
  SrsMetadata,
  SpecificationRecord,
} from "../services/requirementService";

export interface SrsWordSpecEntry<T> extends SpecificationRecord {
  value: T;
}

interface SrsWordEditorProps {
  projectName: string;
  metadata: SrsMetadata;
  functional: SrsWordSpecEntry<FunctionalSpecification>[];
  nonFunctional: SrsWordSpecEntry<NonFunctionalSpecification>[];
  onChangeMetadata: (metadata: SrsMetadata) => void;
  onChangeSpecification: (
    record: SpecificationRecord,
    content: FunctionalSpecification | NonFunctionalSpecification,
  ) => void;
  appendixBContent?: ReactNode;
}

/**
 * Ô nhập liệu trông như chữ trong văn bản Word: không viền, tự giãn chiều cao
 * theo nội dung nên không bao giờ làm tràn khỏi trang A4.
 */
function WordField({
  value,
  onChange,
  label,
  placeholder,
  ariaLabel,
  readOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  ariaLabel?: string;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [value]);

  return (
    <label className="block min-w-0">
      {label && <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>}
      {readOnly ? (
        <div aria-label={ariaLabel ?? label} className="whitespace-pre-wrap break-words px-0 py-0 leading-5 text-slate-900">
          {value || "—"}
        </div>
      ) : (
        <textarea
          ref={ref}
          aria-label={ariaLabel ?? label}
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="w-full resize-none overflow-hidden rounded border border-transparent bg-transparent px-1 py-0.5 font-[inherit] leading-7 text-slate-900 outline-none transition focus:border-violet-300 focus:bg-violet-50/40"
        />
      )}
    </label>
  );
}

function WordListField({
  label,
  values,
  onChange,
  readOnly = false,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  readOnly?: boolean;
}) {
  return (
    <WordField
      label={label}
      value={values.join("\n")}
      onChange={(value) => onChange(value.split(/\r?\n/))}
      ariaLabel={label}
      readOnly={readOnly}
    />
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 mt-8 text-center text-base font-bold uppercase tracking-wide text-slate-950 first:mt-0">
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 mt-5 text-[15px] font-bold text-slate-900">{children}</h3>;
}


function FunctionalBlock({
  record,
  value,
}: {
  record: SpecificationRecord;
  value: FunctionalSpecification;
}) {
  const rows: { label: string; content: ReactNode }[] = [
    { label: "Mã chức năng", content: <WordField label="" value={value.function_code ?? ""} onChange={() => undefined} readOnly /> },
    { label: "Tên chức năng", content: <WordField label="" value={value.function_name ?? ""} onChange={() => undefined} readOnly /> },
    { label: "Mô tả", content: <WordField label="" value={value.description ?? ""} onChange={() => undefined} readOnly /> },
    { label: "Tác nhân", content: <WordListField label="" values={value.actors ?? []} onChange={() => undefined} readOnly /> },
    { label: "Quy trình xử lý", content: <WordListField label="" values={value.process ?? []} onChange={() => undefined} readOnly /> },
    { label: "Dữ liệu đầu vào", content: <WordListField label="" values={value.input_data ?? []} onChange={() => undefined} readOnly /> },
    { label: "Quy tắc xử lý", content: <WordListField label="" values={value.processing_rules ?? []} onChange={() => undefined} readOnly /> },
    { label: "Dữ liệu đầu ra", content: <WordListField label="" values={value.output_data ?? []} onChange={() => undefined} readOnly /> },
    { label: "Tiêu chí chấp nhận", content: <WordListField label="" values={value.acceptance_criteria ?? []} onChange={() => undefined} readOnly /> },
    { label: "Quy tắc nghiệp vụ", content: <WordListField label="" values={value.business_rules ?? []} onChange={() => undefined} readOnly /> },
  ];
  return (
    <table className="w-full table-fixed border-collapse border border-slate-400 text-left text-[13px] leading-5" aria-label={`Bảng đặc tả ${value.function_code || record.feature}`}>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-slate-300 align-top">
            <th scope="row" className="w-[28%] border-r border-slate-300 bg-slate-100 px-2 py-1 text-left font-bold">{row.label}</th>
            <td className="min-w-0 px-2 py-1">{row.content}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NonFunctionalBlock({
  record,
  value,
}: {
  record: SpecificationRecord;
  value: NonFunctionalSpecification;
}) {
  return (
    <article className="mb-4" aria-label={record.feature || "Yêu cầu phi chức năng"}>
      
      <div className="space-y-3">
        {value.items.map((item, index) => (
          <section key={`${item.group}-${index}`} className="break-inside-avoid">
            <h4 className="mb-1 text-sm font-bold text-slate-900">{`${String.fromCharCode(97 + index)}. ${item.group || `Yêu cầu phi chức năng ${index + 1}`}`.replace(/\s*&\s*/g, " và ")}</h4>
            <table className="w-full table-fixed border-collapse border border-slate-400 text-left text-[13px] leading-5" aria-label={item.group || `Bảng yêu cầu phi chức năng ${index + 1}`}>
              <tbody>
                {([
                  ["Tiêu chí", item.criteria],
                  ["Yêu cầu cụ thể", item.requirement],
                  ["Chỉ tiêu / ngưỡng đo lường", item.metric],
                  ["Điều kiện áp dụng", item.conditions],
                  ["Phương pháp kiểm chứng", item.verification_method],
                  ["Phạm vi áp dụng", item.scope],
                  ["Nguồn / căn cứ", item.source],
                ] as [string, string | undefined][]).map(([label, content]) => (
                  <tr key={label} className="border-b border-slate-300 align-top last:border-b-0">
                    <th scope="row" className="w-[28%] border-r border-slate-300 bg-slate-100 px-2 py-1 text-left font-bold">{label}</th>
                    <td className="min-w-0 break-words whitespace-pre-wrap px-2 py-1">{content || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </article>
  );
}

export default function SrsWordEditor({
  projectName,
  metadata,
  functional,
  nonFunctional,
  onChangeMetadata,
  appendixBContent,
}: SrsWordEditorProps) {
  const patchMeta = (key: keyof SrsMetadata, value: string) =>
    onChangeMetadata({ ...metadata, [key]: value });

  return (
    <div
      aria-label="Trang soạn thảo tài liệu SRS"
      className="mx-auto w-full max-w-full overflow-x-auto rounded-xl bg-slate-100 p-3 sm:p-6"
    >
      <article
        className="mx-auto min-h-[1123px] w-full max-w-[794px] bg-white px-6 py-10 shadow-md sm:px-[76px] sm:py-[72px]"
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
      >
        <header className="mb-8 border-b border-slate-300 pb-3 text-center text-xs uppercase tracking-wide text-slate-600">
          Đặc tả yêu cầu phần mềm
        </header>

        <div className="min-w-0 text-[15px] text-slate-900">
          <SectionHeading>TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)</SectionHeading>
          <p className="mb-6 text-center text-sm">Tên dự án: {projectName || "Chưa đặt tên"} · Phiên bản: 1.0</p>

          <SectionHeading>1. Giới thiệu</SectionHeading>
          <SubHeading>1.1 Mục đích</SubHeading>
          <WordField label="1.1 Mục đích" value={metadata.intro_purpose} onChange={(value) => patchMeta("intro_purpose", value)} />
          <SubHeading>1.2 Quy ước tài liệu</SubHeading>
          <p className="text-sm leading-6">Các yêu cầu được trình bày theo nhóm chức năng và phi chức năng. Mã chức năng, tên mục và trường dữ liệu được giữ nhất quán trong toàn bộ tài liệu.</p>
          <SubHeading>1.3 Đối tượng đọc và hướng dẫn đọc</SubHeading>
          <p className="text-sm leading-6">Tài liệu dành cho chủ dự án, người dùng nghiệp vụ, nhà phân tích, nhóm phát triển và kiểm thử. Đọc lần lượt phần giới thiệu, mô tả tổng thể, yêu cầu giao diện và các yêu cầu chức năng/phi chức năng.</p>
          <SubHeading>1.4 Phạm vi sản phẩm</SubHeading>
          <WordField label="1.4 Phạm vi sản phẩm" value={metadata.intro_scope} onChange={(value) => patchMeta("intro_scope", value)} />
          <SubHeading>1.5 Tài liệu tham khảo</SubHeading>
          <p className="text-sm leading-6">Khung trình bày SRS do người dùng cung cấp; các yêu cầu và đặc tả đã được xác nhận trong Giai đoạn 1.</p>
          <SubHeading>1.6 Định nghĩa, thuật ngữ và từ viết tắt</SubHeading>
          <WordField label="1.6 Định nghĩa, thuật ngữ và từ viết tắt" value={metadata.intro_definitions} onChange={(value) => patchMeta("intro_definitions", value)} />

          <SectionHeading>2. Mô tả tổng thể</SectionHeading>
          <SubHeading>2.1 Góc nhìn sản phẩm</SubHeading>
          <p className="text-sm leading-6">{`Hệ thống ${projectName || "đang được xây dựng"} hỗ trợ quy trình phân tích yêu cầu, xây dựng mô hình UML và hoàn thiện tài liệu SRS qua các giai đoạn liên kết.`}</p>
          <SubHeading>2.2 Chức năng sản phẩm</SubHeading>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
            <li>Thu thập, phân tích và xác nhận yêu cầu; xây dựng user story và đặc tả.</li>
            <li>Hỗ trợ xây dựng, rà soát mô hình UML và đồng bộ với yêu cầu.</li>
            <li>Hoàn thiện, rà soát tính nhất quán và xuất tài liệu ở giai đoạn cuối.</li>
          </ul>
          <SubHeading>2.3 Các lớp người dùng</SubHeading>
          <WordField label="2.3 Các lớp người dùng" value={metadata.overview_user_classes} onChange={(value) => patchMeta("overview_user_classes", value)} />
          <SubHeading>2.4 Môi trường vận hành</SubHeading>
          <WordField label="2.4 Môi trường vận hành" value={metadata.overview_environment} onChange={(value) => patchMeta("overview_environment", value)} />
          <SubHeading>2.5 Ràng buộc thiết kế và triển khai</SubHeading>
          <p className="text-sm leading-6">Nội dung triển khai phải tuân theo kiến trúc và công nghệ hiện có; dữ liệu SRS cần đồng bộ với các đặc tả đã lưu.</p>
          <SubHeading>2.6 Tài liệu hướng dẫn người dùng</SubHeading>
          <p className="text-sm leading-6">Hướng dẫn thao tác được thể hiện thông qua các bước nghiệp vụ và hướng dẫn trong giao diện ứng dụng.</p>
          <SubHeading>2.7 Giả định và phụ thuộc</SubHeading>
          <p className="text-sm leading-6">Tài liệu phụ thuộc vào dữ liệu yêu cầu, user story và đặc tả được tạo hoặc xác nhận ở các bước trước.</p>

          <SectionHeading>3. Yêu cầu giao diện</SectionHeading>
          <SubHeading>3.1 Giao diện người dùng</SubHeading>
          <p className="text-sm leading-6">Giao diện cung cấp các bước nghiệp vụ, vùng soạn thảo tài liệu và điều hướng đến từng mục SRS.</p>
          <SubHeading>3.2 Giao diện phần cứng</SubHeading>
          <p className="text-sm leading-6">Không xác định yêu cầu phần cứng chuyên dụng riêng trong dữ liệu đặc tả hiện có.</p>
          <SubHeading>3.3 Giao diện phần mềm</SubHeading>
          <p className="text-sm leading-6">Ứng dụng gồm giao diện web, dịch vụ backend và cơ sở dữ liệu; các thành phần trao đổi dữ liệu qua API của hệ thống.</p>
          <SubHeading>3.4 Giao diện truyền thông</SubHeading>
          <p className="text-sm leading-6">Giao tiếp giữa giao diện và backend thực hiện thông qua các yêu cầu API của ứng dụng.</p>

          <SectionHeading>4. Yêu cầu chức năng</SectionHeading>
          <SubHeading>4.1 Danh sách đặc tả chức năng</SubHeading>
          {functional.length === 0 ? (
            <p className="text-[15px] italic text-slate-500">Chưa có đặc tả chức năng.</p>
          ) : (
            <div className="space-y-6">
              {functional.map((record, index) => (
                <section key={record.id} className="break-inside-avoid">
                  <h4 className="mb-2 text-[15px] font-bold text-slate-900">
                    {String.fromCharCode(97 + index)}. Chức năng {index + 1}: {(record.value.function_name || record.feature || "Chức năng chưa đặt tên").replace(/\s*&\s*/g, " và ")}
                  </h4>
                  <FunctionalBlock record={record} value={record.value} />
                </section>
              ))}
            </div>
          )}

          <SectionHeading>5.1 Danh sách đặc tả phi chức năng</SectionHeading>
          {nonFunctional.length === 0 && <p className="text-[15px] italic text-slate-500">Chưa có đặc tả phi chức năng.</p>}
          {nonFunctional.map((record) => (
            <NonFunctionalBlock key={record.id} record={record} value={record.value} />
          ))}
          <SubHeading>5.2 Quy tắc nghiệp vụ</SubHeading>
          <p className="text-sm leading-6">Các quy tắc nghiệp vụ chi tiết được ghi tại từng đặc tả chức năng tương ứng.</p>

          <SectionHeading>6. Yêu cầu khác</SectionHeading>
          <WordField label="6.1 Yêu cầu khác / ghi chú" value={metadata.appendix_notes} onChange={(value) => patchMeta("appendix_notes", value)} />

          <SectionHeading>Phụ lục A. Thuật ngữ và từ viết tắt</SectionHeading>
          <p className="text-sm leading-6">{metadata.intro_definitions || "Chưa bổ sung thuật ngữ và từ viết tắt."}</p>
          <SectionHeading>Phụ lục B. Mô hình phân tích</SectionHeading>
          {appendixBContent ?? <p className="text-sm leading-6">Các mô hình phân tích UML được quản lý và đồng bộ ở Giai đoạn 2 và Giai đoạn 3.</p>}
        </div>
        <footer className="mt-8 flex min-h-10 items-end justify-between border-t border-slate-300 pt-3 text-xs text-slate-500">
          <span>{projectName || "Hệ thống"}</span>
          <span>Đặc tả yêu cầu phần mềm (SRS)</span>
          <span>Bản thảo</span>
        </footer>
      </article>
    </div>
  );
}
