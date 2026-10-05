/**
 * Định nghĩa 3 GIAI ĐOẠN lớn và các BƯỚC con của từng giai đoạn.
 *
 * Tên bước ở đây là nguồn hiển thị duy nhất, không hardcode lại trong component
 * để giữ đúng tên nghiệp vụ.
 *
 * Lưu ý văn phong: văn bản hiển thị không dùng dấu gạch ngang dài (—).
 */

export type StageId = 1 | 2 | 3;

export interface StepDef {
  id: number;
  label: string;
  hint: string;
  /** Icon minh hoạ cho bước, hiển thị ở tiêu đề panel. */
  icon: string;
}

export interface StageDef {
  id: StageId;
  label: string;
  short: string;
  steps: StepDef[];
}

/** Danh sách bước con của từng giai đoạn. */
export const STAGES: Record<StageId, StageDef> = {
  1: {
    id: 1,
    label: "Giai đoạn 1: Thu thập yêu cầu và đặc tả hệ thống",
    short: "Thu thập & Đặc tả",
    steps: [
      {
        id: 1,
        label: "Nhập yêu cầu",
        hint: "Vai trò, hành động, đối tượng, mục đích",
        icon: "✎",
      },
      {
        id: 2,
        label: "Phân tích thiếu sót",
        hint: "Đủ và còn thiếu",
        icon: "⌕",
      },
      {
        id: 3,
        label: "Kiểm duyệt User Story",
        hint: "AI bổ sung, người dùng rà soát và xác nhận",
        icon: "✓",
      },
      {
        id: 4,
        label: "Sinh đặc tả",
        hint: "Chức năng và phi chức năng",
        icon: "▤",
      },
      {
        id: 5,
        label: "Tổng hợp tài liệu",
        hint: "Danh sách và xuất file",
        icon: "▦",
      },
    ],
  },
  2: {
    id: 2,
    label: "Giai đoạn 2: Từ đặc tả đến mô hình hóa UML",
    short: "Mô hình hóa UML",
    steps: [
      {
        id: 1,
        label: "Trích xuất tác nhân & UC",
        hint: "AI đề xuất, sửa và xác nhận",
        icon: "☺",
      },
      {
        id: 2,
        label: "Sinh biểu đồ UC tổng quát",
        hint: "Preview và tải ảnh",
        icon: "◉",
      },
      {
        id: 3,
        label: "Sinh kịch bản use case chi tiết",
        hint: "Luồng chính, phụ, ngoại lệ",
        icon: "☰",
      },
      {
        id: 4,
        label: "Sinh biểu đồ tương tác",
        hint: "Sequence hoặc Collaboration",
        icon: "⇄",
      },
      {
        id: 5,
        label: "Sinh biểu đồ lớp",
        hint: "Xem lớp trước khi sinh ảnh",
        icon: "◫",
      },
    ],
  },
  3: {
    id: 3,
    label: "Giai đoạn 3: Tùy chỉnh và xuất kết quả",
    short: "Tùy chỉnh & Xuất",
    steps: [
      {
        id: 1,
        label: "Chỉnh sửa thành phần biểu đồ",
        hint: "Tác nhân, UC, lớp, quan hệ",
        icon: "⚙",
      },
      {
        id: 2,
        label: "Sinh/cập nhật mã mô tả biểu đồ",
        hint: "Code editor PlantUML",
        icon: "⌨",
      },
      {
        id: 3,
        label: "Xem trước và hiển thị",
        hint: "Preview render từ mã",
        icon: "◉",
      },
      {
        id: 4,
        label: "Xuất biểu đồ",
        hint: "PNG, SVG và chèn vào tài liệu",
        icon: "↓",
      },
    ],
  },
};

export const STAGE_ORDER: StageId[] = [1, 2, 3];

/** Cặp (giai đoạn, bước con), dùng khi chuyển bước qua sub-stepper. */
export interface StepRef {
  stage: StageId;
  step: number;
}

export function stageOf(stage: StageId): StageDef {
  return STAGES[stage];
}
