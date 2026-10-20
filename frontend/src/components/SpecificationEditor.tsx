import type { FieldMapping, FunctionalSpecification, NonFunctionalSpecification } from "../services/requirementService";
import { inputClass } from "./common/ui/primitives";

export type FunctionalSpecificationTab = "overview" | "flows" | "business-data";

export const emptyFunctionalSpecification = (): FunctionalSpecification => ({
  function_code: "",
  function_name: "",
  description: "",
  actors: [],
  priority: "Must",
  pre_conditions: [],
  main_flow: [],
  alternative_flows: [],
  exception_flows: [],
  post_conditions: [],
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
  ].map((group) => ({ group, criteria: "", requirement: "" })),
});

function ArrayEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <label className="block min-w-0 text-sm font-medium text-slate-700">
      {title}
      <textarea
        aria-label={title}
        rows={Math.min(6, Math.max(2, value.length))}
        value={value.join("\n")}
        onChange={(event) => onChange(event.target.value.split(/\r?\n/))}
        className={`${inputClass} mt-1 min-w-[12rem] max-w-full max-h-36 overflow-y-auto resize-y`}
      />
    </label>
  );
}

export function FunctionalSpecificationEditor({
  value,
  onChange,
  activeTab,
}: {
  value: FunctionalSpecification;
  onChange: (value: FunctionalSpecification) => void;
  activeTab: FunctionalSpecificationTab;
}) {
  const textField = (
    key: "function_code" | "function_name" | "description",
    label: string,
    multiline = false,
  ) => (
    <label className="block min-w-0 text-sm font-medium text-slate-700">
      {label}
      {multiline ? (
        <textarea
          aria-label={label}
          rows={3}
          value={value[key]}
          onChange={(event) => onChange({ ...value, [key]: event.target.value })}
          className={`${inputClass} mt-1 min-w-[12rem] max-w-full max-h-28 overflow-y-auto resize-y`}
        />
      ) : (
        <input
          aria-label={label}
          value={value[key]}
          onChange={(event) => onChange({ ...value, [key]: event.target.value })}
          className={`${inputClass} mt-1`}
        />
      )}
    </label>
  );

  const flowArrays: { key: keyof FunctionalSpecification; label: string }[] = [
    { key: "pre_conditions", label: "Điều kiện tiên quyết" },
    { key: "main_flow", label: "Luồng chính" },
    { key: "alternative_flows", label: "Luồng thay thế" },
    { key: "exception_flows", label: "Luồng ngoại lệ" },
    { key: "post_conditions", label: "Điều kiện sau" },
  ];

  return (
    <div className="min-w-0">
      {activeTab === "overview" && (
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {textField("function_code", "Mã chức năng")}
          {textField("function_name", "Tên chức năng")}
          <label className="block min-w-0 text-sm font-medium text-slate-700">
            Mức ưu tiên
            <select
              aria-label="Mức ưu tiên"
              value={value.priority}
              onChange={(event) =>
                onChange({ ...value, priority: event.target.value as FunctionalSpecification["priority"] })
              }
              className={`${inputClass} mt-1`}
            >
              {["Must", "Should", "Could", "Won't"].map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">{textField("description", "Mô tả", true)}</div>
          <div className="md:col-span-2">
            <ArrayEditor
              title="Tác nhân"
              value={value.actors}
              onChange={(items) => onChange({ ...value, actors: items })}
            />
          </div>
        </div>
      )}
      {activeTab === "flows" && (
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {flowArrays.map(({ key, label }) => (
            <ArrayEditor
              key={key}
              title={label}
              value={value[key] as string[]}
              onChange={(items) => onChange({ ...value, [key]: items })}
            />
          ))}
        </div>
      )}
      {activeTab === "business-data" && (
        <div className="space-y-5">
          <ArrayEditor
            title="Quy tắc nghiệp vụ"
            value={value.business_rules}
            onChange={(items) => onChange({ ...value, business_rules: items })}
          />
          <section className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-800">Ánh xạ trường dữ liệu</h4>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    field_mapping: [
                      ...value.field_mapping,
                      { field_name: "", data_type: "String", required: false, validation_rule: "" },
                    ],
                  })
                }
                className="text-sm font-medium text-violet-700 hover:text-violet-900"
              >
                Thêm trường
              </button>
            </div>
            <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[54rem] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Tên trường</th>
                    <th className="px-3 py-2">Kiểu dữ liệu</th>
                    <th className="px-3 py-2">Bắt buộc</th>
                    <th className="px-3 py-2">Quy tắc kiểm tra</th>
                    <th className="px-3 py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {value.field_mapping.map((field, index) => (
                    <tr key={index} className="border-t border-slate-100 align-top">
                      <FieldMappingRow
                        field={field}
                        onChange={(next) => {
                          const fields = [...value.field_mapping];
                          fields[index] = next;
                          onChange({ ...value, field_mapping: fields });
                        }}
                        onRemove={() =>
                          onChange({
                            ...value,
                            field_mapping: value.field_mapping.filter((_, row) => row !== index),
                          })
                        }
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
              {value.field_mapping.length === 0 && (
                <p className="bg-white p-3 text-sm text-slate-500">Chưa có trường dữ liệu.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
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
      <td className="min-w-48 px-3 py-2">
        <input
          aria-label="Tên trường"
          placeholder="Tên trường"
          value={field.field_name}
          onChange={(event) => onChange({ ...field, field_name: event.target.value })}
          className={inputClass}
        />
      </td>
      <td className="min-w-40 px-3 py-2">
        <input
          aria-label="Kiểu dữ liệu"
          placeholder="Kiểu dữ liệu"
          value={field.data_type}
          onChange={(event) => onChange({ ...field, data_type: event.target.value })}
          className={inputClass}
        />
      </td>
      <td className="px-3 py-2">
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
      <td className="min-w-64 px-3 py-2">
        <input
          aria-label="Quy tắc kiểm tra"
          placeholder="Quy tắc kiểm tra"
          value={field.validation_rule}
          onChange={(event) => onChange({ ...field, validation_rule: event.target.value })}
          className={inputClass}
        />
      </td>
      <td className="px-3 py-2">
        <button type="button" onClick={onRemove} className="text-sm text-rose-700 hover:text-rose-900">
          Xóa
        </button>
      </td>
    </>
  );
}

export function NonFunctionalSpecificationEditor({
  value,
  onChange,
}: {
  value: NonFunctionalSpecification;
  onChange: (value: NonFunctionalSpecification) => void;
}) {
  return (
    <div className="space-y-4">
      {value.items.map((item, index) => (
        <section key={item.group} className="grid gap-2.5 rounded-xl border border-violet-100 bg-violet-50/30 p-3 sm:p-3.5 md:grid-cols-2">
          <div className="flex items-center gap-2 md:col-span-2"><span className="h-5 w-1 rounded-full bg-violet-500" /><h4 className="text-sm font-semibold text-slate-800">{item.group}</h4></div>
          <label className="text-sm font-medium text-slate-700">
            Tiêu chí
            <textarea
              aria-label={`Tiêu chí ${item.group}`}
              rows={3}
              value={item.criteria}
              onChange={(event) => {
                const items = [...value.items];
                items[index] = { ...item, criteria: event.target.value };
                onChange({ items });
              }}
              className={`${inputClass} mt-1 min-w-[12rem] max-w-full max-h-28 overflow-y-auto resize-y`}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Yêu cầu
            <textarea
              aria-label={`Yêu cầu ${item.group}`}
              rows={3}
              value={item.requirement}
              onChange={(event) => {
                const items = [...value.items];
                items[index] = { ...item, requirement: event.target.value };
                onChange({ items });
              }}
              className={`${inputClass} mt-1 max-h-28 overflow-y-auto resize-y`}
            />
          </label>
        </section>
      ))}
    </div>
  );
}
