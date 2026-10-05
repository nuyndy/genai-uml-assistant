import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import type {
  FieldMapping,
  FunctionalSpecification,
  NonFunctionalSpecification,
  SrsMetadata,
  SpecificationRecord,
} from "../services/requirementService";

export interface SrsWordSpecEntry<T> extends SpecificationRecord {
  value: T;
}

interface SrsWordEditorProps {
  metadata: SrsMetadata;
  functional: SrsWordSpecEntry<FunctionalSpecification>[];
  nonFunctional: SrsWordSpecEntry<NonFunctionalSpecification>[];
  onChangeMetadata: (metadata: SrsMetadata) => void;
  onChangeSpecification: (
    record: SpecificationRecord,
    content: FunctionalSpecification | NonFunctionalSpecification,
  ) => void;
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
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  ariaLabel?: string;
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
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <textarea
        ref={ref}
        aria-label={ariaLabel ?? label}
        rows={1}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-none overflow-hidden rounded border border-transparent bg-transparent px-1 py-0.5 font-[inherit] leading-7 text-slate-900 outline-none transition focus:border-violet-300 focus:bg-violet-50/40"
      />
    </label>
  );
}

function WordListField({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <WordField
      label={label}
      value={values.join("\n")}
      onChange={(value) => onChange(value.split(/\r?\n/))}
      ariaLabel={label}
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

function FieldMappingTable({
  fields,
  onChange,
}: {
  fields: FieldMapping[];
  onChange: (fields: FieldMapping[]) => void;
}) {
  const patch = (index: number, next: Partial<FieldMapping>) => {
    const rows = [...fields];
    rows[index] = { ...rows[index], ...next };
    onChange(rows);
  };
  const addRow = () =>
    onChange([
      ...fields,
      { field_name: "", data_type: "String", required: false, validation_rule: "" },
    ]);

  return (
    <div className="mt-3 min-w-0">
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-y border-slate-400">
              {["Tên trường", "Kiểu dữ liệu", "Bắt buộc", "Quy tắc kiểm tra"].map((header) => (
                <th key={header} className="px-2 py-1.5 font-bold text-slate-800">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <tr key={index} className="border-b border-slate-200 align-top">
                <td className="px-2 py-1.5">
                  <input
                    aria-label={`Tên trường dòng ${index + 1}`}
                    value={field.field_name}
                    onChange={(event) => patch(index, { field_name: event.target.value })}
                    className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-slate-900 outline-none focus:border-violet-300 focus:bg-violet-50/40"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    aria-label={`Kiểu dữ liệu dòng ${index + 1}`}
                    value={field.data_type}
                    onChange={(event) => patch(index, { data_type: event.target.value })}
                    className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-slate-900 outline-none focus:border-violet-300 focus:bg-violet-50/40"
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <input
                    aria-label={`Bắt buộc dòng ${index + 1}`}
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) => patch(index, { required: event.target.checked })}
                    className="accent-violet-600"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    aria-label={`Quy tắc kiểm tra dòng ${index + 1}`}
                    value={field.validation_rule}
                    onChange={(event) => patch(index, { validation_rule: event.target.value })}
                    className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-slate-900 outline-none focus:border-violet-300 focus:bg-violet-50/40"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {fields.length === 0 && (
        <p className="py-2 text-[13px] italic text-slate-500">Chưa có trường dữ liệu.</p>
      )}
      <button
        type="button"
        onClick={addRow}
        className="mt-1 text-[13px] font-medium text-violet-700 hover:text-violet-900"
      >
        Thêm trường
      </button>
    </div>
  );
}

function FunctionalBlock({
  record,
  value,
  onChange,
}: {
  record: SpecificationRecord;
  value: FunctionalSpecification;
  onChange: (value: FunctionalSpecification) => void;
}) {
  return (
    <article
      className="mb-6 border-l-2 border-violet-300 pl-4"
      aria-label={`Đặc tả ${value.function_code || record.feature}`}
    >
      <SubHeading>
        {value.function_code || "UC"} - {value.function_name || record.feature}
      </SubHeading>
      <div className="min-w-0 space-y-2">
        <WordField
          label="Mã chức năng"
          value={value.function_code}
          onChange={(function_code) => onChange({ ...value, function_code })}
        />
        <WordField
          label="Tên chức năng"
          value={value.function_name}
          onChange={(function_name) => onChange({ ...value, function_name })}
        />
        <WordField
          label="Mô tả"
          value={value.description}
          onChange={(description) => onChange({ ...value, description })}
        />
        <WordField
          label="Mức ưu tiên"
          value={value.priority}
          onChange={(priority) =>
            onChange({ ...value, priority: priority as FunctionalSpecification["priority"] })
          }
        />
        <WordListField
          label="Tác nhân"
          values={value.actors}
          onChange={(actors) => onChange({ ...value, actors })}
        />
        <WordListField
          label="Điều kiện tiên quyết"
          values={value.pre_conditions}
          onChange={(pre_conditions) => onChange({ ...value, pre_conditions })}
        />
        <WordListField
          label="Luồng chính"
          values={value.main_flow}
          onChange={(main_flow) => onChange({ ...value, main_flow })}
        />
        <WordListField
          label="Luồng thay thế"
          values={value.alternative_flows}
          onChange={(alternative_flows) => onChange({ ...value, alternative_flows })}
        />
        <WordListField
          label="Luồng ngoại lệ"
          values={value.exception_flows}
          onChange={(exception_flows) => onChange({ ...value, exception_flows })}
        />
        <WordListField
          label="Điều kiện sau"
          values={value.post_conditions}
          onChange={(post_conditions) => onChange({ ...value, post_conditions })}
        />
        <WordListField
          label="Quy tắc nghiệp vụ"
          values={value.business_rules}
          onChange={(business_rules) => onChange({ ...value, business_rules })}
        />
        <FieldMappingTable
          fields={value.field_mapping}
          onChange={(field_mapping) => onChange({ ...value, field_mapping })}
        />
      </div>
    </article>
  );
}

function NonFunctionalBlock({
  record,
  value,
  onChange,
}: {
  record: SpecificationRecord;
  value: NonFunctionalSpecification;
  onChange: (value: NonFunctionalSpecification) => void;
}) {
  return (
    <article
      className="mb-6 border-l-2 border-violet-300 pl-4"
      aria-label={`Đặc tả phi chức năng ${record.feature}`}
    >
      <SubHeading>{record.feature || "Đặc tả phi chức năng"}</SubHeading>
      <div className="space-y-2">
        {value.items.map((item, index) => {
          const patch = (next: Partial<typeof item>) => {
            const items = [...value.items];
            items[index] = { ...item, ...next };
            onChange({ items });
          };
          return (
            <div key={item.group}>
              <WordField
                label={item.group}
                value={item.criteria}
                onChange={(criteria) => patch({ criteria })}
                ariaLabel={`Tiêu chí ${item.group}`}
              />
              <WordField
                label={`Yêu cầu - ${item.group}`}
                value={item.requirement}
                onChange={(requirement) => patch({ requirement })}
                ariaLabel={`Yêu cầu ${item.group}`}
              />
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default function SrsWordEditor({
  metadata,
  functional,
  nonFunctional,
  onChangeMetadata,
  onChangeSpecification,
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
          <SectionHeading>Tài liệu đặc tả yêu cầu phần mềm (SRS)</SectionHeading>

          <SectionHeading>1. Giới thiệu</SectionHeading>
          <div className="space-y-2">
            <WordField
              label="1.1 Mục đích"
              value={metadata.intro_purpose}
              onChange={(value) => patchMeta("intro_purpose", value)}
            />
            <WordField
              label="1.2 Phạm vi"
              value={metadata.intro_scope}
              onChange={(value) => patchMeta("intro_scope", value)}
            />
            <WordField
              label="1.3 Định nghĩa, thuật ngữ và từ viết tắt"
              value={metadata.intro_definitions}
              onChange={(value) => patchMeta("intro_definitions", value)}
            />
          </div>

          <SectionHeading>2. Mô tả tổng thể</SectionHeading>
          <div className="space-y-2">
            <WordField
              label="2.1 Các lớp người dùng"
              value={metadata.overview_user_classes}
              onChange={(value) => patchMeta("overview_user_classes", value)}
            />
            <WordField
              label="2.2 Môi trường vận hành"
              value={metadata.overview_environment}
              onChange={(value) => patchMeta("overview_environment", value)}
            />
          </div>

          <SectionHeading>3. Chi tiết yêu cầu</SectionHeading>
          <SubHeading>3.1 Đặc tả chức năng</SubHeading>
          {functional.length === 0 && (
            <p className="text-[15px] italic text-slate-500">Chưa có đặc tả chức năng.</p>
          )}
          {functional.map((record) => (
            <FunctionalBlock
              key={record.id}
              record={record}
              value={record.value}
              onChange={(value) => onChangeSpecification(record, value)}
            />
          ))}

          <SubHeading>3.2 Đặc tả phi chức năng</SubHeading>
          {nonFunctional.map((record) => (
            <NonFunctionalBlock
              key={record.id}
              record={record}
              value={record.value}
              onChange={(value) => onChangeSpecification(record, value)}
            />
          ))}

          <SectionHeading>4. Phụ lục</SectionHeading>
          <WordField
            label="Ghi chú"
            value={metadata.appendix_notes}
            onChange={(value) => patchMeta("appendix_notes", value)}
          />
        </div>

        <footer className="mt-8 flex justify-between border-t border-slate-300 pt-3 text-xs text-slate-500">
          <span>GenAI UML Assistant</span>
          <span>Bản thảo - Trang 1</span>
        </footer>
      </article>
    </div>
  );
}
