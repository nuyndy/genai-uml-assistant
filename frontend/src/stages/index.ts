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
      {
        id: 1,
        label: "Đồng bộ SRS và UML",
        hint: "Đối chiếu đặc tả với mô hình đã xác nhận",
        icon: "⇄",
      },
      {
        id: 2,
        label: "Chỉnh sửa và cập nhật",
        hint: "Cập nhật mô hình hoặc mã PlantUML và theo dõi thay đổi",
        icon: "⌨",
      },
      {
        id: 3,
        label: "Kiểm tra nhất quán",
        hint: "Kiểm tra sai lệch, độ bao phủ và liên kết truy vết",
        icon: "✓",
      },
      {
        id: 4,
        label: "Duyệt baseline và xuất",
        hint: "Xử lý sai lệch, duyệt phiên bản và xuất tài liệu chính thức",
        icon: "↓",
      },
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
