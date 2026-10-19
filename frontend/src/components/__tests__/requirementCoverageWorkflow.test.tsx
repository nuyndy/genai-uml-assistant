import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import GiaiDoan1 from "../features/giai-doan-1/GiaiDoan1";
import Stepper from "../common/Stepper";
import { emptyWorkflow, type WorkflowState } from "../../types/workflow";
import type {
  RequirementCoverageAnalysis,
  RequirementPayload,
  RequirementRecord,
} from "../../services/requirementService";

const mocked = vi.hoisted(() => {
  const requirement: RequirementRecord = {
    id: 31,
    project_id: 55,
    content: JSON.stringify({
      actor: "Khách hàng",
      action: "đặt",
      target_object: "đơn hàng",
      purpose: "mua sản phẩm",
      pre_conditions: [],
      business_rules: [],
    }),
    status: "draft",
    user_story: null,
  };
  const candidate = {
    actor: "Quản trị viên",
    action: "quản lý",
    target_object: "tài khoản",
    purpose: "kiểm soát quyền truy cập",
    pre_conditions: [],
    business_rules: [],
    reason: "Hệ thống cần quản lý tài khoản người dùng.",
  };
  const records = [requirement] as RequirementRecord[];
  const analysis: RequirementCoverageAnalysis = {
    is_sufficient: false,
    summary: "Còn thiếu chức năng quản trị tài khoản.",
    suggestions: [candidate, {
      ...candidate,
      action: "xem",
      target_object: "báo cáo",
      purpose: "theo dõi hoạt động",
      reason: "Cần theo dõi hoạt động hệ thống.",
    }],
  };
  return {
    records,
    analysis,
    checkProjectRequirementCoverage: vi.fn().mockResolvedValue(analysis),
    createProjectRequirementsBatch: vi.fn().mockImplementation(
      (_projectId: number, requirements: RequirementPayload[]) => {
        const added = requirements.map((content, index) => ({
          id: 40 + records.length + index,
          project_id: 55,
          content: JSON.stringify(content),
          status: "draft" as const,
          user_story: null,
        }));
        records.push(...added);
        return Promise.resolve(added);
      },
    ),
    listProjectRequirements: vi.fn().mockImplementation(() => Promise.resolve(records)),
    listProjectUserStories: vi.fn().mockResolvedValue([]),
    listProjectSpecifications: vi.fn().mockResolvedValue([]),
    createRequirement: vi.fn(),
    deleteRequirement: vi.fn(),
    analyzeProjectRequirementsBatch: vi.fn(),
    previewProjectUserStories: vi.fn(),
    confirmProjectRequirementsBatch: vi.fn(),
    generateNonFunctionalSpecification: vi.fn(),
    generateSpecification: vi.fn(),
    getSpecificationDocument: vi.fn(),
    updateSpecification: vi.fn(),
    saveSrsMetadata: vi.fn(),
    exportSpecificationDocument: vi.fn(),
  };
});

vi.mock("../../services/requirementService", () => ({
  analyzeProjectRequirementsBatch: mocked.analyzeProjectRequirementsBatch,
  checkProjectRequirementCoverage: mocked.checkProjectRequirementCoverage,
  confirmProjectRequirementsBatch: mocked.confirmProjectRequirementsBatch,
  createProjectRequirementsBatch: mocked.createProjectRequirementsBatch,
  createRequirement: mocked.createRequirement,
  deleteRequirement: mocked.deleteRequirement,
  exportSpecificationDocument: mocked.exportSpecificationDocument,
  generateNonFunctionalSpecification: mocked.generateNonFunctionalSpecification,
  generateSpecification: mocked.generateSpecification,
  getSpecificationDocument: mocked.getSpecificationDocument,
  listProjectRequirements: mocked.listProjectRequirements,
  listProjectSpecifications: mocked.listProjectSpecifications,
  listProjectUserStories: mocked.listProjectUserStories,
  previewProjectUserStories: mocked.previewProjectUserStories,
  saveSrsMetadata: mocked.saveSrsMetadata,
  updateSpecification: mocked.updateSpecification,
}));

function Harness() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WorkflowState>(emptyWorkflow);
  return (
    <>
      <Stepper stage={1} step={step} maxUnlockedStep={5} onStepChange={setStep} />
      <GiaiDoan1
      projectId={55}
      state={state}
      setState={setState}
      step={step}
      onStepChange={setStep}
      />
    </>
  );
}

describe("Step 1 requirement coverage check", () => {
  afterEach(() => {
    mocked.records.splice(1);
    vi.clearAllMocks();
  });

  it("checks saved requirements and persists only the suggestions the user selects", async () => {
    render(<Harness />);

    await screen.findByText("Khách hàng: đặt đơn hàng");
    const continueButton = screen.getByRole("button", { name: /Phân tích và làm rõ/ });
    expect(continueButton).toHaveProperty("disabled", false);

    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra bằng AI" }));
    await screen.findByText("Còn thiếu chức năng quản trị tài khoản.");

    const accountSuggestion = screen.getByRole("checkbox", {
      name: "Chọn chức năng quản lý tài khoản",
    });
    const reportSuggestion = screen.getByRole("checkbox", {
      name: "Chọn chức năng xem báo cáo",
    });
    fireEvent.click(accountSuggestion);
    expect(screen.getByRole("button", { name: "Thêm 1 chức năng đã chọn" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Thêm 1 chức năng đã chọn" }));

    await waitFor(() => {
      expect(mocked.createProjectRequirementsBatch).toHaveBeenCalledWith(55, [{
        actor: "Quản trị viên",
        action: "quản lý",
        target_object: "tài khoản",
        purpose: "kiểm soát quyền truy cập",
        pre_conditions: [],
        business_rules: [],
      }]);
      expect(screen.getByText("Quản trị viên: quản lý tài khoản")).toBeTruthy();
    });
    expect(reportSuggestion).toHaveProperty("checked", false);
    expect(continueButton).toHaveProperty("disabled", false);

    fireEvent.click(continueButton);
    await screen.findByText("Kết quả phân tích");
  });
});
