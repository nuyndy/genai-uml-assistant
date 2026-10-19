import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import Stepper from "../common/Stepper";
import GiaiDoan2 from "../features/giai-doan-2/GiaiDoan2";
import { emptyWorkflow, type WorkflowState } from "../../types/workflow";
import { STAGES, type StageId } from "../../stages";

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
}));

/** Sao chép nguyên văn maxUnlockedStep() của App.tsx cho stage 2. */
function maxUnlockedStage2(workflow: WorkflowState): number {
  const total = STAGES[2].steps.length;
  if (workflow.classDiagramUrl) return total;
  if (workflow.umlClasses.length > 0) return 5;
  if (workflow.interactions.length > 0) return 5;
  if (Object.keys(workflow.scenarios).length > 0) return 5;
  if (workflow.useCaseDiagramCode) return 3;
  if (workflow.actors.length > 0 && workflow.usecases.length > 0) return 3;
  return 1;
}

function Harness({ initial }: { initial: WorkflowState }) {
  const [state, setState] = useState<WorkflowState>(initial);
  const [step, setStep] = useState(1);
  return (
    <>
      <Stepper
        stage={2 as StageId}
        step={step}
        maxUnlockedStep={maxUnlockedStage2(state)}
        onStepChange={setStep}
      />
      <GiaiDoan2 projectId={1} state={state} setState={setState} step={step} onStepChange={setStep} />
    </>
  );
}

describe("Chuyển bước ở Giai đoạn 2", () => {
  it("sau khi lưu actor và use case thì bước 2 mở khoá", () => {
    const initial = emptyWorkflow();
    initial.actors = [{ id: 1, name: "Khách hàng" }];
    initial.usecases = [{ id: 1, name: "Đặt hàng", description: "" }];
    render(<Harness initial={initial} />);

    const step2 = screen.getByRole("button", { name: /Xác nhận biểu đồ Use Case/ });
    expect(step2).not.toBeDisabled();
    fireEvent.click(step2);
    expect(screen.getByText("Biểu đồ use case tổng quát")).toBeTruthy();
  });

  it("nút ở cuối Bước 1 chuyển sang Bước 2", () => {
    const initial = emptyWorkflow();
    render(<Harness initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục sang Bước 2" }));
    expect(screen.getByText("Biểu đồ use case tổng quát")).toBeTruthy();
  });

  it("Bước 2 sang Bước 3 mở khoá khi biểu đồ UC đã có mã nguồn dù chưa render ảnh", () => {
    const initial = emptyWorkflow();
    initial.actors = [{ id: 1, name: "Khách hàng" }];
    initial.usecases = [{ id: 1, name: "Đặt hàng", description: "" }];
    // useCaseDiagramUrl null (dịch vụ render chưa sẵn sàng) nhưng vẫn có mã nguồn.
    initial.useCaseDiagramCode = "@startuml\n@enduml";
    render(<Harness initial={initial} />);

    const step3 = screen.getByRole("button", { name: /Xác nhận kịch bản Use Case/ });
    expect(step3).not.toBeDisabled();
    fireEvent.click(step3);
    expect(screen.getByText("Sinh kịch bản use case")).toBeTruthy();
  });

  it("Bước 3 sang Bước 4 bị chặn khi chưa có kịch bản nào", () => {
    const initial = emptyWorkflow();
    initial.actors = [{ id: 1, name: "Khách hàng" }];
    initial.usecases = [{ id: 1, name: "Đặt hàng", description: "" }];
    render(<Harness initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: /Sinh biểu đồ UC tổng quát/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục sang Bước 3" }));
    const toStep4 = screen.getByRole("button", { name: "Tiếp tục sang Bước 4" });
    expect(toStep4).toBeDisabled();
  });

  it("Bước 3 sang Bước 4 mở khi đã có kịch bản", () => {
    const initial = emptyWorkflow();
    initial.actors = [{ id: 1, name: "Khách hàng" }];
    initial.usecases = [{ id: 1, name: "Đặt hàng", description: "" }];
    initial.scenarios = { 1: { mainFlow: ["Bước 1"], altFlows: [], exceptions: [] } };
    render(<Harness initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: /Sinh kịch bản use case chi tiết/ }));
    const toStep4 = screen.getByRole("button", { name: "Tiếp tục sang Bước 4" });
    expect(toStep4).not.toBeDisabled();
    fireEvent.click(toStep4);
    // Tên bước xuất hiện cả trên sub-stepper lẫn tiêu đề card.
    expect(screen.getAllByText("Sinh biểu đồ tương tác").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Sequence" })).toBeTruthy();
  });

  it("Bước 4 sang Bước 5 không bị chặn", async () => {
    const initial = emptyWorkflow();
    initial.actors = [{ id: 1, name: "Khách hàng" }];
    initial.usecases = [{ id: 1, name: "Đặt hàng", description: "" }];
    initial.scenarios = { 1: { mainFlow: ["Bước 1"], altFlows: [], exceptions: [] } };
    render(<Harness initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: /Xác nhận biểu đồ tương tác/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Tiếp tục sang Bước 5" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục sang Bước 5" }));
    expect(screen.getByText("Mô hình lớp suy luận")).toBeTruthy();
  });
});
