import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import GiaiDoan1 from "../features/giai-doan-1/GiaiDoan1";
import GiaiDoan2 from "../features/giai-doan-2/GiaiDoan2";
import GiaiDoanStepper from "../common/GiaiDoanStepper";
import Stepper from "../common/Stepper";
import { emptyWorkflow, type WorkflowState } from "../../types/workflow";

vi.mock("../common/services/requirementService", () => ({
  listProjectRequirements: vi.fn().mockResolvedValue([]),
  listProjectUserStories: vi.fn().mockResolvedValue([]),
  listProjectSpecifications: vi.fn().mockResolvedValue([]),
  getSpecificationDocument: vi.fn().mockResolvedValue({
    project_id: 1,
    metadata: {
      intro_purpose: "",
      intro_scope: "",
      intro_definitions: "",
      overview_user_classes: "",
      overview_environment: "",
      appendix_notes: "",
    },
    sections: [],
    raw_markdown: "",
  }),
  generateSpecification: vi.fn(),
  generateProjectSpecificationsBatch: vi.fn(),
  generateNonFunctionalSpecification: vi.fn(),
  updateSpecification: vi.fn(),
  saveSrsMetadata: vi.fn(),
  exportSpecificationDocument: vi.fn(),
  analyzeProjectRequirementsBatch: vi.fn(),
  checkProjectRequirementCoverage: vi.fn(),
  confirmProjectRequirementsBatch: vi.fn(),
  createRequirement: vi.fn(),
  createProjectRequirementsBatch: vi.fn(),
  deleteRequirement: vi.fn(),
  previewProjectUserStories: vi.fn(),
}));

vi.mock("../common/services/umlService", () => ({
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

/** Mô phỏng App.tsx: 3 giai đoạn lớn, mỗi giai đoạn có sub-stepper riêng. */
function Workspace() {
  const [workflow, setWorkflow] = useState<WorkflowState>(emptyWorkflow);
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [step, setStep] = useState(1);
  return (
    <>
      <GiaiDoanStepper
        stage={stage}
        maxUnlockedStage={3}
        completedStages={[]}
        onStageChange={(next) => {
          setStage(next);
          setStep(1);
        }}
      />
      <Stepper stage={stage} step={step} maxUnlockedStep={5} onStepChange={setStep} />
      {stage === 1 && (
        <GiaiDoan1
          projectId={undefined}
          state={workflow}
          setState={setWorkflow}
          step={step}
          onStepChange={setStep}
        />
      )}
      {stage === 2 && (
        <GiaiDoan2
          projectId={1}
          state={workflow}
          setState={setWorkflow}
          step={step}
          onStepChange={setStep}
        />
      )}
    </>
  );
}

describe("Chuyển giai đoạn lớn trong workspace", () => {
  it("nhấn sang Giai đoạn 2 hiện nội dung Bước 1, không trắng màn", async () => {
    render(<Workspace />);

    const stage2 = screen.getByRole("button", { name: /Mô hình UML/ });
    expect(stage2).not.toBeDisabled();
    fireEvent.click(stage2);

    // Chờ request nạp dữ liệu UML xong rồi mới khẳng định nội dung hiện ra.
    expect(await screen.findByText("Tác nhân và use case")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Xác nhận biểu đồ Use Case/ })).toBeTruthy();
  });

  it("vẫn hiện Bước 1 khi API nạp dữ liệu thất bại", async () => {
    const { getProjectUmlState } = await import("../common/services/umlService");
    vi.mocked(getProjectUmlState).mockRejectedValueOnce(
      new Error("Không kết nối được server"),
    );
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: /Mô hình UML/ }));

    // Lỗi tải dữ liệu không được làm trắng màn hình.
    expect(await screen.findByText("Tác nhân và use case")).toBeTruthy();
    expect(screen.getByText(/Không kết nối được server/)).toBeTruthy();
  });
});
