import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import GiaiDoan2 from "../GiaiDoan2";
import { emptyWorkflow, type WorkflowState } from "../../types/workflow";

/**
 * Payload ĐÚNG NHƯ backend FastAPI trả về từ GET /api/projects/{id}/uml-state
 * (xem backend/schemas/uml.py -> class UseCaseRecord): các trường kịch bản
 * là main_flow / alt_flow / exception_flow (snake_case).
 */
const { backendUmlState } = vi.hoisted(() => ({
  backendUmlState: {
    actors: [{ id: 1, project_id: 1, name: "Khách hàng" }],
    use_cases: [
      {
        id: 10,
        specification_id: 100,
        name: "Đặt hàng",
        main_flow: ["Chọn sản phẩm", "Xác nhận đơn"],
        alt_flow: [],
        exception_flow: [],
      },
    ],
    relations: [],
    diagrams: [],
    classes: [],
    class_relations: [],
  },
}));

vi.mock("../../services/umlService", () => ({
  getProjectUmlState: vi.fn().mockResolvedValue(backendUmlState),
  listProjectSpecificationsForUml: vi.fn().mockResolvedValue([
    {
      id: 100,
      user_story_id: 5,
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
}));

function Harness() {
  const [state, setState] = useState<WorkflowState>(emptyWorkflow);
  return (
    <GiaiDoan2
      projectId={1}
      state={state}
      setState={setState}
      step={1}
      onStepChange={() => {}}
    />
  );
}

describe("Giai đoạn 2 nạp dữ liệu thật từ backend", () => {
  it("hiển thị tác nhân và use case đã lưu, không trắng màn hình", async () => {
    render(<Harness />);
    expect(await screen.findByText(/Khách hàng/)).toBeTruthy();
    expect(await screen.findByText(/Đặt hàng/)).toBeTruthy();
  });

  it("đọc kịch bản từ main_flow/alt_flow/exception_flow của backend", async () => {
    const { getProjectUmlState } = await import("../../services/umlService");
    vi.mocked(getProjectUmlState).mockResolvedValueOnce({
      ...backendUmlState,
      use_cases: [
        {
          id: 10,
          specification_id: 100,
          name: "Đặt hàng",
          main_flow: ["Chọn sản phẩm", "Xác nhận đơn"],
          alt_flow: ["Bỏ chọn sản phẩm"],
          exception_flow: ["Sản phẩm hết hàng"],
        },
      ],
    });
    const HarnessFlow = () => {
      const [state, setState] = useState<WorkflowState>(emptyWorkflow);
      return (
        <GiaiDoan2
          projectId={1}
          state={state}
          setState={setState}
          step={3}
          onStepChange={() => {}}
        />
      );
    };
    render(<HarnessFlow />);
    // main_flow được đọc đúng -> use case bị gắn nhãn "Đã có kịch bản"
    // (trước đây nhãn này không xuất hiện vì kịch bản luôn rỗng).
    expect(await screen.findByText(/Đặt hàng/)).toBeTruthy();
    expect(screen.getByText("Đã có kịch bản")).toBeTruthy();
  });
});

describe("Giai đoạn 2 khi dự án chưa có đặc tả", () => {
  it("hiện thông báo hướng dẫn thay vì trắng màn hình", async () => {
    const { listProjectSpecificationsForUml } = await import("../../services/umlService");
    vi.mocked(listProjectSpecificationsForUml).mockResolvedValueOnce([]);
    render(<Harness />);
    expect(await screen.findByText(/Project chưa có đặc tả/)).toBeTruthy();
    expect(screen.getAllByText(/Giai đoạn 1/).length).toBeGreaterThan(0);
  });
});

describe("Giai đoạn 2 khi API lỗi", () => {
  it("hiện thông báo lỗi, không trắng màn hình", async () => {
    const { getProjectUmlState } = await import("../../services/umlService");
    vi.mocked(getProjectUmlState).mockRejectedValueOnce(new Error("Mất kết nối server"));
    render(<Harness />);
    expect(await screen.findByText(/Không thể tải dữ liệu UML/)).toBeTruthy();
    expect(screen.getByText(/Mất kết nối server/)).toBeTruthy();
  });
});