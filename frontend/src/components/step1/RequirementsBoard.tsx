import type { RequirementRecord } from "./types";

interface Props {
  records: RequirementRecord[];
  onRemove: (id: number) => void;
}

/**
 * "Ảnh" tổng hợp: hiển thị TẤT CẢ yêu cầu đã nhập trong phiên làm việc.
 * Mỗi bản ghi render đầy đủ Actor / Action / Object / Purpose + đặc tả đã sinh.
 */
export default function RequirementsBoard({ records, onRemove }: Props) {
  return (
    <div className="bg-white rounded-2xl border-slate-200 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Bảng tổng hợp yêu cầu đã nhập
        </h2>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium">
          {records.length} yêu cầu
        </span>
      </div>

      {records.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">
          Chưa có yêu cầu nào được lưu. <br /> Điền form và bấm "Lưu yêu cầu" để
          xem tổng hợp tại đây...
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <th className="py-2 pr-3 font-semibold">#</th>
                <th className="py-2 pr-3 font-semibold">Vai trò</th>
                <th className="py-2 pr-3 font-semibold">Hành động</th>
                <th className="py-2 pr-3 font-semibold">Đối tượng</th>
                <th className="py-2 pr-3 font-semibold">Mục đích</th>
                <th className="py-2 pr-3 font-semibold">Đặc tả đã sinh</th>
                <th className="py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec, index) => (
                <tr
                  key={rec.id}
                  className="align-top border-b border-slate-50 hover:bg-slate-50/60 transition"
                >
                  <td className="py-3 pr-3 text-slate-400 font-medium">
                    {index + 1}
                  </td>
                  <td className="py-3 pr-3 font-medium text-slate-900">
                    {rec.actor}
                  </td>
                  <td className="py-3 pr-3 text-slate-700">{rec.action}</td>
                  <td className="py-3 pr-3 text-slate-700">
                    {rec.targetObject}
                  </td>
                  <td className="py-3 pr-3 text-slate-500 italic">
                    {rec.purpose || "—"}
                  </td>
                  <td className="py-3 pr-3 text-slate-600 max-w-xs">
                    {rec.content}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(rec.id)}
                      title="Xóa yêu cầu này"
                      className="text-slate-400 hover:text-rose-500 transition text-xs font-medium rounded-md px-2 py-1 hover:bg-rose-50"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
