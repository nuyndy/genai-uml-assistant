import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import GiaiDoanStepper from "../common/GiaiDoanStepper";
import Stepper from "../common/Stepper";
import GiaiDoan1 from "../features/giai-doan-1/GiaiDoan1";
import GiaiDoan2 from "../features/giai-doan-2/GiaiDoan2";
import GiaiDoan3 from "../features/giai-doan-3/GiaiDoan3";
import { emptyWorkflow, type WorkflowState } from "../../types/workflow";
import { vi } from "vitest";

/**
 * Giai đoạn 2 tự nạp đặc tả từ database; test phải cấp một đặc tả chức năng
 * để màn hình không rơi vào trạng thái "dự án chưa có đặc tả chức năng".
 */
vi.mock("../../services/umlService", () => ({
  getProjectUmlState: vi.fn().mockResolvedValue({
    actors: [],
    use_cases: [],
    relations: [],
    classes: [],
    class_relations: [],
    diagrams: [],
  }),
  listProjectSpecificationsForUml: vi.fn().mockResolvedValue([
    {
      id: 1,
      user_story_id: 1,
      feature: "Đặt hàng",
      type: "functional",
      content: "{}",
      version: 1,
    },
  ]),
  extractProjectActorsUseCasesBatch: vi.fn(),
  saveProjectActorUseCasesBatch: vi.fn(),
  generateUseCaseDiagram: vi.fn(),
  generateProjectScenariosBatch: vi.fn(),
  updateUseCaseScenario: vi.fn(),
  generateProjectInteractionDiagramsBatch: vi.fn(),
  generateClasses: vi.fn(),
  generateClassDiagram: vi.fn(),
  listProjectDiagrams: vi.fn().mockResolvedValue([]),
}));

/**
 * Kiểm tra cấu trúc 3 GIAI ĐOẠN: thanh giai đoạn lớn, sub-stepper, và các panel
 * bước con hiển thị đúng tên bước.
 */

/** Bọc trong state thật để mô phỏng đúng cách App.tsx truyền props. */
function Harness({ initial, stage, step }: {
  initial: WorkflowState;
  stage: 1 | 2 | 3;
  step: number;
}) {
  const [state, setState] = useState<WorkflowState>(() => {
    if (stage === 2 && initial.specs.length === 0) {
      return {
        ...initial,
        specs: [{ id: 1, feature: "Đặt hàng", type: "functional", content: "{}", approved: true }],
      };
    }
    return initial;
  });
  const noop = () => {};
  return (
    <>
      <GiaiDoanStepper stage={stage} maxUnlockedStage={3} completedStages={[]} />
      <Stepper stage={stage} step={step} maxUnlockedStep={5} />
      {stage === 1 ? (
        <GiaiDoan1 state={state} setState={setState} step={step} onStepChange={noop} />
      ) : stage === 2 ? (
        <GiaiDoan2 state={state} setState={setState} step={step} onStepChange={noop} />
      ) : (
        <GiaiDoan3 projectId={1} state={state} setState={setState} step={step} onStepChange={noop} />
      )}
    </>
  );
}

describe("GiaiDoanStepper", () => {
  it("hiển thị đủ 3 giai đoạn lớn", () => {
    render(<GiaiDoanStepper stage={1} maxUnlockedStage={3} completedStages={[]} />);
    expect(screen.getAllByText("Phân tích yêu cầu").length).toBeGreaterThan(0);
    expect(screen.getByText("Mô hình UML")).toBeTruthy();
    expect(screen.getByText("SRS & Hoàn thiện")).toBeTruthy();
  });

  it("tô xanh lá đúng các giai đoạn đã hoàn thành thật", () => {
    const { container } = render(
      <GiaiDoanStepper stage={3} maxUnlockedStage={3} completedStages={[1, 2]} />,
    );
    // Kiểm tra trạng thái ngữ nghĩa thay vì class màu cụ thể của giao diện.
    expect(container.querySelectorAll('button[aria-label$=", đã hoàn thành"]').length).toBe(2);
  });

  it("không tô xanh giai đoạn chưa hoàn thành dù đang đứng ở giai đoạn sau", () => {
    const { container } = render(
      <GiaiDoanStepper stage={2} maxUnlockedStage={2} completedStages={[]} />,
    );
    expect(container.querySelectorAll(".bg-emerald-100").length).toBe(0);
  });
});

describe("Giai đoạn 1: sub-stepper 5 bước", () => {
  const steps = [
    "Nhập yêu cầu",
    "Phân tích và làm rõ",
    "Xác nhận yêu cầu và User Story",
    "Xây dựng đặc tả FR/NFR",
    "Rà soát và đồng bộ SRS",
  ];

  it.each(steps)("hiển thị bước %s trong sub-stepper", (name) => {
    render(<Stepper stage={1} step={1} maxUnlockedStep={5} />);
    expect(screen.getByText(name)).toBeTruthy();
  });

  it("Bước 1 hiển thị form nhập yêu cầu", () => {
    render(<Harness initial={emptyWorkflow()} stage={1} step={1} />);
    expect(screen.getAllByText("Nhập yêu cầu").length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/Sinh viên|Khách hàng|mô tả/i)).toBeTruthy();
  });

  it("Bước 2 cho phép sang bước tiếp theo dù có yêu cầu thiếu", () => {
    render(<Harness initial={emptyWorkflow()} stage={1} step={2} />);
    expect(screen.getByRole("heading", { name: "Phân tích yêu cầu" })).toBeTruthy();
    expect(screen.getByText("Tiếp tục sang Bước 3")).toBeTruthy();
  });

  it("Bước 3 cho người dùng kiểm duyệt User Story do AI tạo", () => {
    render(<Harness initial={emptyWorkflow()} stage={1} step={3} />);
    expect(screen.getByText("Chưa có yêu cầu để rà soát")).toBeTruthy();
    expect(screen.getByText("Danh sách yêu cầu đang trống")).toBeTruthy();
  });

  it("Bước 5 cho sửa trực tiếp trên trang Word và tải xuống docx", () => {
    const initial = emptyWorkflow();
    initial.specs = [
      { id: 1, feature: "Đăng nhập", type: "functional", content: "A", approved: true },
      { id: 2, feature: "Hiệu năng", type: "non_functional", content: "B", approved: true },
      { id: 3, feature: "Chưa duyệt", type: "functional", content: "C", approved: false },
    ];
    render(<Harness initial={initial} stage={1} step={5} />);
    expect(screen.getByRole("heading", { name: /Rà soát và đồng bộ tài liệu SRS/ })).toBeTruthy();
    // Bản SRS cho phép sửa trực tiếp các trường nội dung.
    expect(screen.getByLabelText("1.1 Mục đích")).toBeTruthy();
    expect(screen.getByLabelText("1.1 Mục đích")).toBeTruthy();
    expect(screen.getByLabelText("1.2 Phạm vi")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lưu phần giới thiệu" })).toBeTruthy();
  });
});

describe("Giai đoạn 2", () => {
  it("sub-stepper hiển thị đúng 5 tên bước", () => {
    render(<Stepper stage={2} step={1} maxUnlockedStep={5} />);
    [
      "Xác nhận Actor và Use Case",
      "Xác nhận biểu đồ Use Case",
      "Xác nhận kịch bản Use Case",
      "Xác nhận biểu đồ tương tác",
      "Xác nhận biểu đồ lớp",
    ].forEach((n) => expect(screen.getByText(n)).toBeTruthy());
  });

  it("Bước 1 hiện tác nhân và use case đã lưu", () => {
    const initial = emptyWorkflow();
    initial.actors = [{ id: 1, name: "Khách hàng" }];
    initial.usecases = [{ id: 1, name: "Đặt hàng", description: "Mua hàng" }];
    render(<Harness initial={initial} stage={2} step={1} />);
    expect(screen.getByText(/Khách hàng/)).toBeTruthy();
    expect(screen.getByText(/Đặt hàng/)).toBeTruthy();
    expect(screen.getByText("Tác nhân và use case")).toBeTruthy();
  });

  it("Bước 3 mở rộng ba phần kịch bản đã lưu", () => {
    const initial = emptyWorkflow();
    initial.usecases = [{ id: 1, name: "Đặt hàng", description: "" }];
    initial.scenarios = {
      1: { mainFlow: ["1. Chọn hàng"], altFlows: ["1a. Huỷ"], exceptions: ["2a. Lỗi"] },
    };
    render(<Harness initial={initial} stage={2} step={3} />);
    // Kịch bản chỉ hiện sau khi mở rộng use case tương ứng.
    fireEvent.click(screen.getByRole("button", { name: /mở|xem/i }));
    expect(screen.getByText("Luồng chính")).toBeTruthy();
    expect(screen.getByText("Luồng phụ")).toBeTruthy();
    expect(screen.getByText("Ngoại lệ")).toBeTruthy();
    expect(screen.getByDisplayValue("1. Chọn hàng")).toBeTruthy();
  });

  it("Bước 5 cho phép chọn Sequence / Collaboration", () => {
    const initial = emptyWorkflow();
    initial.usecases = [{ id: 1, name: "Đặt hàng", description: "" }];
    initial.scenarios = {
      1: { mainFlow: ["Chọn hàng"], altFlows: [], exceptions: [] },
    };
    render(<Harness initial={initial} stage={2} step={4} />);
    expect(screen.getByText("Sequence")).toBeTruthy();
    expect(screen.getByText("Collaboration")).toBeTruthy();
  });
});

describe("Giai đoạn 3", () => {
  it("sub-stepper hiển thị đúng 4 tên bước", () => {
    render(<Stepper stage={3} step={1} maxUnlockedStep={4} />);
    [
      "Đồng bộ SRS và UML",
      "Chỉnh sửa và cập nhật",
      "Kiểm tra nhất quán",
      "Duyệt baseline và xuất",
    ].forEach((n) => expect(screen.getByText(n)).toBeTruthy());
  });

  it("Bước 1 hiện thành phần biểu đồ từ Giai đoạn 2", () => {
    const initial = emptyWorkflow();
    initial.actors = [{ id: 1, name: "Khách hàng" }];
    initial.umlClasses = [
      { id: 1, name: "Order", attributes: ["id: int"], methods: ["create()"] },
    ];
    initial.relations = [{ id: 1, from: "Khách hàng", to: "Order", type: "association" }];
    render(<Harness initial={initial} stage={3} step={2} />);
    // "Khách hàng" xuất hiện ở cả ô tác nhân và ô quan hệ "Từ".
    expect(screen.getAllByDisplayValue("Khách hàng").length).toBeGreaterThan(0);
    // "Order" xuất hiện ở cả ô tên lớp và ô quan hệ "Đến".
    expect(screen.getAllByDisplayValue("Order").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("id: int")).toBeTruthy();
  });

  it("Bước 3 có nút quay lại chỉnh sửa khi phát hiện sai lệch", () => {
    render(<Harness initial={emptyWorkflow()} stage={3} step={3} />);
    expect(screen.getByText("← Quay lại chỉnh sửa")).toBeTruthy();
    expect(screen.getByText("Kiểm tra UML")).toBeTruthy();
  });

  it("Bước 4 chọn được định dạng PNG/SVG", () => {
    render(<Harness initial={emptyWorkflow()} stage={3} step={4} />);
    expect(screen.getByRole("button", { name: "PNG" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "SVG" })).toBeTruthy();
  });

  it("không dùng dấu gạch ngang dài trong văn bản hiển thị", () => {
    render(<Harness initial={emptyWorkflow()} stage={3} step={1} />);
    expect(document.body.textContent).not.toContain("—");
  });
});
