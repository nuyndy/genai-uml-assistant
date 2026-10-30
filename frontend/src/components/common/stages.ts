/**
 * Định nghĩa 3 giai đoạn nghiệp vụ của GenAI UML Assistant.
 * Tên bước hiển thị được quản lý tập trung tại đây.
 */

export type StageId = 1 | 2 | 3;

export interface StepDef {
  id: number;
  label: string;
  hint: string;
  icon: string;
}

export interface StageDef {
  id: StageId;
  label: string;
  short: string;
  steps: StepDef[];
}

export const STAGES: Record<StageId, StageDef> = {
  1: {
    id: 1,
    label: "Giai đoạn 1: Phân tích và chốt yêu cầu",
    short: "Phân tích yêu cầu",
    steps: [
      {
        id: 1,
        label: "Nhập yêu cầu",
        hint: "Mô tả bài toán, mục tiêu và phạm vi hệ thống",
        icon: "✎",
      },
      {
        id: 2,
        label: "Phân tích và làm rõ",
        hint: "Xác định thông tin còn thiếu, mâu thuẫn và cần xác nhận",
        icon: "⌕",
      },
      {
        id: 3,
        label: "Xác nhận yêu cầu và User Story",
        hint: "Rà soát vai trò, chức năng và tiêu chí chấp nhận",
        icon: "✓",
      },
      {
        id: 4,
        label: "Xây dựng đặc tả FR/NFR",
        hint: "Sinh và rà soát đặc tả dựa trên User Story đã xác nhận",
        icon: "▤",
      },
      {
        id: 5,
        label: "Rà soát và đồng bộ SRS",
        hint: "Xem bản nháp, rà soát nội dung và đồng bộ đặc tả; chưa xuất tài liệu chính thức",
        icon: "▦",
      },
    ],
  },

  2: {
    id: 2,
    label: "Giai đoạn 2: Xây dựng mô hình UML",
    short: "Mô hình UML",
    steps: [
      { id: 1, label: "Actor và Use Case", hint: "Xác định tác nhân, use case và các quan hệ nghiệp vụ", icon: "◉" },
      { id: 2, label: "Kịch bản Use Case", hint: "Sinh, chỉnh sửa và lưu luồng chính, luồng phụ, ngoại lệ cho từng use case", icon: "≡" },
      { id: 3, label: "Biểu đồ Use Case", hint: "Sinh, chỉnh sửa mã PlantUML và render biểu đồ tổng quát", icon: "◎" },
      { id: 4, label: "Cấu hình các lớp", hint: "Chỉnh sửa tên lớp, thuộc tính, phương thức và quan hệ giữa các lớp", icon: "◫" },
      { id: 5, label: "Biểu đồ lớp", hint: "Sinh và xem biểu đồ lớp từ cấu hình lớp đã thiết lập", icon: "▤" },
      { id: 6, label: "Biểu đồ tương tác", hint: "Sinh Sequence hoặc Communication Diagram cho từng use case", icon: "⇄" },
    ],
  },

  3: {
    id: 3,
    label: "Giai đoạn 3: Đồng bộ SRS và hoàn thiện sản phẩm",
    short: "SRS & Hoàn thiện",
    steps: [
      { id: 1, label: "Rà soát và đồng bộ SRS", hint: "Rà soát nội dung SRS và xác nhận các đặc tả trước khi đối chiếu UML", icon: "▤" },
      { id: 2, label: "Chỉnh sửa mô hình UML", hint: "Chỉnh sửa mã PlantUML, xem trước và lưu mô hình", icon: "⌨" },
      { id: 3, label: "Kiểm tra nhất quán", hint: "Kiểm tra sai lệch giữa SRS, yêu cầu, mô hình và mã UML", icon: "⌕" },
      { id: 4, label: "Xử lý sai lệch và duyệt baseline", hint: "BA quyết định xử lý hoặc chấp nhận sai lệch có lý do trước khi chốt baseline", icon: "✓" },
    ],
  },
};

export const STAGE_ORDER: StageId[] = [1, 2, 3];

export interface StepRef {
  stage: StageId;
  step: number;
}

export function stageOf(stage: StageId): StageDef {
  return STAGES[stage];
}
