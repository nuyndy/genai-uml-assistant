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
        label: "Lập đặc tả FR/NFR",
        hint: "Sinh, rà soát và xác nhận yêu cầu chức năng, phi chức năng",
        icon: "▤",
      },
      {
        id: 5,
        label: "Chốt tài liệu yêu cầu",
        hint: "Kiểm tra độ bao phủ và tổng hợp kết quả giai đoạn 1",
        icon: "▦",
      },
    ],
  },

  2: {
    id: 2,
    label: "Giai đoạn 2: Xây dựng và xác nhận mô hình UML",
    short: "Mô hình UML",
    steps: [
      {
        id: 1,
        label: "Xác nhận Actor và Use Case",
        hint: "AI đề xuất, người dùng rà soát và xác nhận danh sách",
        icon: "☺",
      },
      {
        id: 2,
        label: "Xác nhận biểu đồ Use Case",
        hint: "Kiểm tra tác nhân, chức năng và các quan hệ",
        icon: "◉",
      },
      {
        id: 3,
        label: "Xác nhận kịch bản Use Case",
        hint: "Luồng chính, luồng thay thế và luồng ngoại lệ",
        icon: "☰",
      },
      {
        id: 4,
        label: "Xác nhận biểu đồ tương tác",
        hint: "Kiểm tra thông điệp và sự tương tác giữa các đối tượng",
        icon: "⇄",
      },
      {
        id: 5,
        label: "Xác nhận biểu đồ lớp",
        hint: "Kiểm tra lớp, thuộc tính, phương thức và quan hệ",
        icon: "◫",
      },
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
