import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import GiaiDoan1 from "../features/giai-doan-1/GiaiDoan1";
import { emptyWorkflow, type WorkflowState } from "../../types/workflow";
import type { SpecificationRecord, UserStory } from "../../services/requirementService";

const mocked = vi.hoisted(() => {
  const story: UserStory = {
    id: 7,
    requirement_id: 3,
    role: "Khách hàng",
    feature: "Đặt hàng",
    benefit: "Mua sản phẩm",
    acceptance_criteria: "Đơn hàng được tạo.",
  };
  const initialContent = {
    function_code: "UC07",
    function_name: "Đặt hàng",
    description: "Tạo đơn hàng.",
    actors: ["Khách hàng"],
    priority: "Must",
    pre_conditions: [],
    main_flow: ["1. Xác nhận giỏ hàng."],
    alternative_flows: [],
    exception_flows: [],
    post_conditions: [],
    business_rules: [],
    field_mapping: [],
  };
  const state: { records: SpecificationRecord[] } = { records: [] };
  const getSpecRecord = (content: typeof initialContent, version: number): SpecificationRecord => ({
    id: 10,
    user_story_id: story.id,
    feature: story.feature,
    type: "functional",
    content: JSON.stringify(content),
    version,
    approval_status: "draft",
  });

  return {
    story,
    initialContent,
    state,
    listProjectRequirements: vi.fn().mockResolvedValue([]),
    listProjectUserStories: vi.fn().mockResolvedValue([story]),
    listProjectSpecifications: vi.fn().mockImplementation(() => Promise.resolve(state.records)),
    generateSpecification: vi.fn().mockImplementation((
      _storyId: number,
      _type: string,
      regenerate = false,
    ) => {
      const content = regenerate
        ? { ...initialContent, function_name: "Đặt hàng do AI tạo lại" }
        : initialContent;
      const currentVersion = state.records[0]?.version ?? 1;
      const record = getSpecRecord(content, regenerate ? currentVersion : 1);
      state.records = [record];
      return Promise.resolve(record);
    }),
    updateSpecification: vi.fn().mockImplementation((_id: number, content: typeof initialContent) => {
      const record = getSpecRecord(content, 2);
      state.records = [record];
      return Promise.resolve(record);
    }),
    getSpecificationDocument: vi.fn().mockImplementation(() => Promise.resolve({
      project_id: 55,
      metadata: {
        intro_purpose: "",
        intro_scope: "",
        intro_definitions: "",
        overview_user_classes: "",
        overview_environment: "",
        appendix_notes: "",
      },
      sections: [],
      raw_markdown: `## 3.1 Đặc tả chức năng\n\n${state.records[0]
        ? JSON.parse(state.records[0].content).function_name
        : "Chưa có"}`,
    })),
    createRequirement: vi.fn(),
    deleteRequirement: vi.fn(),
    generateNonFunctionalSpecification: vi.fn().mockImplementation(() => {
      const record: SpecificationRecord = {
        id: 11,
        user_story_id: null,
        feature: "Đặc tả phi chức năng",
        type: "non_functional",
        content: JSON.stringify({
          items: [
            "Hiệu năng & Dung lượng",
            "Bảo mật & An toàn",
            "Độ tin cậy & Khả dụng",
            "Khả năng bảo trì & Mở rộng",
            "Khả năng sử dụng & Tương thích",
          ].map((group) => ({ group, criteria: "Tiêu chí", requirement: "Yêu cầu" })),
        }),
        version: 1,
        approval_status: "draft",
      };
      state.records = [...state.records.filter((item) => item.id !== record.id), record];
      return Promise.resolve(record);
    }),
    previewProjectUserStories: vi.fn(),
    updateSpecificationUnused: vi.fn(),
    saveSrsMetadata: vi.fn(),
    exportSpecificationDocument: vi.fn(),
    analyzeProjectRequirementsBatch: vi.fn(),
    confirmProjectRequirementsBatch: vi.fn(),
  };
});

vi.mock("../../services/requirementService", () => ({
  analyzeProjectRequirementsBatch: mocked.analyzeProjectRequirementsBatch,
  confirmProjectRequirementsBatch: mocked.confirmProjectRequirementsBatch,
  createRequirement: mocked.createRequirement,
  deleteRequirement: mocked.deleteRequirement,
  generateNonFunctionalSpecification: mocked.generateNonFunctionalSpecification,
  generateSpecification: mocked.generateSpecification,
  getSpecificationDocument: mocked.getSpecificationDocument,
  listProjectRequirements: mocked.listProjectRequirements,
  listProjectSpecifications: mocked.listProjectSpecifications,
  listProjectUserStories: mocked.listProjectUserStories,
  previewProjectUserStories: mocked.previewProjectUserStories,
  updateSpecification: mocked.updateSpecification,
  saveSrsMetadata: mocked.saveSrsMetadata,
  exportSpecificationDocument: mocked.exportSpecificationDocument,
}));

function Harness() {
  const [step, setStep] = useState(4);
  const [state, setState] = useState<WorkflowState>(emptyWorkflow);
  return (
    <GiaiDoan1
      projectId={55}
      state={state}
      setState={setState}
      step={step}
      onStepChange={setStep}
    />
  );
}

describe("one-time specification generation and manual editing", () => {
  afterEach(() => {
    mocked.state.records = [];
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("automatically generates on entering step 4 and shares manual changes with the SRS preview", async () => {
    render(<Harness />);

    const accordion = await screen.findByRole("button", { name: "Mở đặc tả UC07" });
    expect(accordion).toHaveProperty("ariaExpanded", "false");
    fireEvent.click(accordion);
    const storySection = accordion.closest("section");
    if (!storySection) throw new Error("Functional specification section was not rendered.");
    const story = within(storySection);
    await waitFor(() => {
      expect(mocked.generateSpecification).toHaveBeenCalledTimes(1);
      expect(story.getByRole("textbox", { name: "Tên chức năng" })).toBeTruthy();
    });
    expect(story.getByRole("tab", { name: "Tổng quan" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(story.getByRole("tab", { name: "Luồng xử lý" }));
    expect(story.getByRole("textbox", { name: "Luồng chính" })).toBeTruthy();
    fireEvent.click(story.getByRole("tab", { name: "Nghiệp vụ & Dữ liệu" }));
    expect(story.getByRole("table")).toBeTruthy();
    fireEvent.click(story.getByRole("tab", { name: "Tổng quan" }));
    expect(screen.queryByRole("button", { name: "Tự viết thủ công" })).toBeNull();
    expect(story.getByRole("button", { name: "Lưu thay đổi" })).toBeTruthy();

    fireEvent.change(story.getByRole("textbox", { name: "Tên chức năng" }), {
      target: { value: "Đặt hàng đã sửa thủ công" },
    });
    fireEvent.click(story.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(mocked.updateSpecification).toHaveBeenCalledTimes(1));
    expect(mocked.generateSpecification).toHaveBeenCalledTimes(1);
    expect(mocked.state.records[0].version).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục sang Bước 5" }));
    await screen.findByText("Tài liệu SRS");
    // Tên chức năng đã sửa ở Bước 4 được phản ánh trên tiêu đề đặc tả trong trang Word.
    await waitFor(() => {
      expect(screen.getAllByText(/Đặt hàng đã sửa thủ công/).length).toBeGreaterThan(0);
    });
    expect(screen.getByLabelText("Tên chức năng")).toHaveProperty(
      "value",
      "Đặt hàng đã sửa thủ công",
    );
    expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Sửa trực tiếp trên trang tài liệu như Word/),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lưu đặc tả" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Thử sinh bằng AI" })).toBeNull();
  });

  it("lets the user explicitly regenerate an existing specification without incrementing its version", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<Harness />);

    const accordion = await screen.findByRole("button", { name: "Mở đặc tả UC07" });
    fireEvent.click(accordion);
    const storySection = accordion.closest("section");
    if (!storySection) throw new Error("Functional specification section was not rendered.");
    const story = within(storySection);
    await story.findByRole("textbox", { name: "Tên chức năng" });
    await waitFor(() => expect(mocked.generateSpecification).toHaveBeenCalledTimes(1));
    fireEvent.click(story.getByRole("button", { name: "Tạo lại bằng AI" }));

    await waitFor(() => {
      expect(mocked.generateSpecification).toHaveBeenCalledTimes(2);
      expect(story.getByRole("textbox", { name: "Tên chức năng" })).toHaveProperty(
        "value",
        "Đặt hàng do AI tạo lại",
      );
    });
    expect(mocked.generateSpecification).toHaveBeenLastCalledWith(7, "functional", true);
    expect(mocked.state.records[0].version).toBe(1);
    expect(window.confirm).toHaveBeenCalledOnce();
  });
});
