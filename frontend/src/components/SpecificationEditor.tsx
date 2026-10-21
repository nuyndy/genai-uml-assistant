import type { FieldMapping, FunctionalSpecification, NonFunctionalSpecification } from "../services/requirementService";
import { inputClass } from "./common/ui/primitives";

export type FunctionalSpecificationTab = "overview" | "flows" | "business-data";

export const emptyFunctionalSpecification = (): FunctionalSpecification => ({
  function_code: "",
  function_name: "",
  description: "",
  actors: [],
  actors: [],
  process: [],
  input_data: [],
  processing_rules: [],
  output_data: [],
  acceptance_criteria: [],
  business_rules: [],
  field_mapping: [],
});

export const emptyNonFunctionalSpecification = (): NonFunctionalSpecification => ({
  items: [
    "Hiệu năng & Dung lượng",
    "Bảo mật & An toàn",
    "Độ tin cậy & Khả dụng",
    "Khả năng bảo trì & Mở rộng",
    "Khả năng sử dụng & Tương thích",
  ].map((group) => ({ group, criteria: "", requirement: "", metric: "", conditions: "", verification_method: "", scope: "", source: "" })),
});

function ArrayEditor({
  title,
  value,
  onChange,
  rows,
  fillHeight = false,
}: {
  title: string;
  value: string[];
  onChange: (value: string[]) => void;
  rows?: number;
  fillHeight?: boolean;
}) {
  return (
    <label className={`${fillHeight ? "flex h-full min-h-0 flex-1 flex-col" : "block"} min-w-0 text-sm font-medium text-slate-700`}>
      {title}
      <textarea
        aria-label={title}
        rows={rows ?? Math.min(12, Math.max(3, value.reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 72)), 0)) )}
        value={value.join("\n")}
        onChange={(event) => onChange(event.target.value.split(/\r?\n/))}
        className={`${inputClass} mt-1 block ${fillHeight ? "h-full min-h-0 flex-1" : "h-auto"} w-full min-w-0 resize-y overflow-x-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-6`}
      />
    </label>
  );
}

export function FunctionalSpecificationEditor({ value, onChange }: {
  value: FunctionalSpecification; onChange: (value: FunctionalSpecification) => void; activeTab?: FunctionalSpecificationTab;
}) {
  const text = (key: "function_code" | "function_name" | "description", label: string, multiline = false) => (
    <label className="block min-w-0 text-sm font-medium text-slate-700">{label}
      {multiline ? <textarea aria-label={label} rows={3} value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })} className={`${inputClass} mt-1 w-full resize-y`} />
        : <input aria-label={label} value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })} className={`${inputClass} mt-1`} />}
    </label>
  );
  const list = (key: "actors" | "process" | "input_data" | "processing_rules" | "output_data" | "acceptance_criteria" | "business_rules", label: string) => (
    <ArrayEditor title={label} value={value[key] ?? []} onChange={(items) => onChange({ ...value, [key]: items })} rows={3} />
  );
  return <div className="min-w-0 space-y-4">
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      {text("function_code", "Mã yêu cầu")}{text("function_name", "Tên yêu cầu")}
      <div className="md:col-span-2">{text("description", "Giới thiệu / Mô tả", true)}</div>
      {list("actors", "Tác nhân liên quan")}{list("input_data", "Dữ liệu vào")}
      <div className="md:col-span-2">{list("process", "Quy trình xử lý")}</div>
      <div className="md:col-span-2">{list("processing_rules", "Xử lý / Quy tắc xử lý")}</div>
      <div className="md:col-span-2">{list("output_data", "Kết quả đầu ra")}</div>
      <div className="md:col-span-2">{list("acceptance_criteria", "Tiêu chí chấp nhận")}</div>
      <div className="md:col-span-2">{list("business_rules", "Quy tắc nghiệp vụ liên quan")}</div>
    </div>
    <section className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-slate-800">Ánh xạ trường dữ liệu</h4>
        <button type="button" onClick={() => onChange({ ...value, field_mapping: [...(value.field_mapping ?? []), { field_name: "", data_type: "String", required: false, validation_rule: "" }] })} className="text-sm font-medium text-violet-700">Thêm trường</button>
      </div>
      <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[42rem] table-fixed border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-600"><tr><th className="px-3 py-2">Tên trường</th><th className="px-3 py-2">Kiểu dữ liệu</th><th className="px-3 py-2">Bắt buộc</th><th className="px-3 py-2">Quy tắc kiểm tra</th><th className="px-3 py-2">Thao tác</th></tr></thead>
        <tbody>{(value.field_mapping ?? []).map((field,index)=><tr key={index} className="border-t border-slate-100 align-top"><FieldMappingRow field={field} onChange={(next)=>{const fields=[...value.field_mapping];fields[index]=next;onChange({...value,field_mapping:fields});}} onRemove={()=>onChange({...value,field_mapping:value.field_mapping.filter((_,row)=>row!==index)})}/></tr>)}</tbody>
      </table>{(!value.field_mapping || value.field_mapping.length===0)&&<p className="bg-white p-3 text-sm text-slate-500">Chưa có trường dữ liệu.</p>}</div>
    </section>
  </div>;
}

function FieldMappingRow({
  field,
  onChange,
  onRemove,
}: {
  field: FieldMapping;
  onChange: (value: FieldMapping) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <td className="px-3 py-2">
        <input
          aria-label="Tên trường"
          placeholder="Tên trường"
          value={field.field_name}
          onChange={(event) => onChange({ ...field, field_name: event.target.value })}
          className={`${inputClass} w-full min-w-0`}
        />
      </td>
      <td className="px-3 py-2">
        <input
          aria-label="Kiểu dữ liệu"
          placeholder="Kiểu dữ liệu"
          value={field.data_type}
          onChange={(event) => onChange({ ...field, data_type: event.target.value })}
          className={`${inputClass} w-full min-w-0`}
        />
      </td>
      <td className="px-3 py-2 align-middle">
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-700">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(event) => onChange({ ...field, required: event.target.checked })}
            className="accent-violet-600"
          />
          Bắt buộc
        </label>
      </td>
      <td className="min-w-0 px-3 py-2 align-middle">
        <textarea
          aria-label="Quy tắc kiểm tra"
          placeholder="Quy tắc kiểm tra"
          rows={1}
          value={field.validation_rule}
          onChange={(event) => onChange({ ...field, validation_rule: event.target.value })}
          className={`${inputClass} block h-10 min-h-10 w-full min-w-0 resize-none overflow-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-5`}
          style={{ height: `${Math.max(2.5, Math.max(field.validation_rule.split("\n").length, Math.ceil(field.validation_rule.length / 52)) * 1.25 + 0.5)}rem` }}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right align-middle">
        <button type="button" onClick={onRemove} className="text-sm text-rose-700 hover:text-rose-900">
          Xóa
        </button>
      </td>
    </>
  );
}

export function NonFunctionalSpecificationEditor({ value, onChange }: {
  value: NonFunctionalSpecification; onChange: (value: NonFunctionalSpecification) => void;
}) {
  const patch = (index: number, key: keyof NonFunctionalSpecification["items"][number], next: string) => {
    const items=[...value.items]; items[index]={...items[index],[key]:next}; onChange({items});
  };
  const fields: {key:keyof NonFunctionalSpecification["items"][number];label:string}[]=[
    {key:"criteria",label:"Mô tả / Tiêu chí"},{key:"requirement",label:"Yêu cầu cụ thể"},
    {key:"metric",label:"Chỉ tiêu / Ngưỡng đo lường"},{key:"conditions",label:"Điều kiện áp dụng"},
    {key:"verification_method",label:"Phương pháp kiểm chứng"},{key:"scope",label:"Mức độ / Phạm vi áp dụng"},{key:"source",label:"Nguồn / Căn cứ"}
  ];
  return <div className="space-y-4">{value.items.map((item,index)=><section key={item.group} className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 sm:p-4">
    <h4 className="mb-3 text-sm font-semibold text-slate-800">{item.group}</h4><div className="grid gap-3 md:grid-cols-2">
    {fields.map(({key,label})=><label key={key} className="block min-w-0 text-sm font-medium text-slate-700">{label}
      <textarea aria-label={`${label} — ${item.group}`} rows={2} value={item[key] ?? ""} onChange={(event)=>patch(index,key,event.target.value)} className={`${inputClass} mt-1 block w-full resize-y`}/>
    </label>)}</div></section>)}</div>;
}
