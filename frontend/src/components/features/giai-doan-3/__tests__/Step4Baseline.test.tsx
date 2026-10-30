import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Step4Baseline from "../steps/Step4Baseline";
import type { BaselineIssueDecision, ProjectBaseline } from "../../../common/services/umlService";

const issue: BaselineIssueDecision = {
  type: "missing_trace",
  status: "open",
  title: "Thiếu liên kết truy vết",
  detail: "REQ-001 chưa liên kết với UC-001",
};

function setup(overrides: Partial<ComponentProps<typeof Step4Baseline>> = {}) {
  const props = {
    baselines: [] as ProjectBaseline[],
    issues: [issue],
    busy: false,
    hasChecked: true,
    message: "",
    onIssuesChange: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(undefined),
    onSaveIssues: vi.fn().mockResolvedValue(undefined),
    onApprove: vi.fn().mockResolvedValue(undefined),
    onExport: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<Step4Baseline {...props} />);
  return props;
}

describe("Step4Baseline", () => {
  it("không cho tạo baseline trước khi kiểm tra nhất quán", () => {
    setup({ hasChecked: false });
    expect(screen.getByRole("button", { name: "Tạo baseline nháp" })).toBeDisabled();
    expect(screen.getByText(/hoàn tất kiểm tra nhất quán/)).toBeTruthy();
  });

  it("yêu cầu lý do khi BA chấp nhận sai lệch", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Quyết định sai lệch 1"), {
      target: { value: "accepted" },
    });
    expect(screen.getByLabelText("Lý do chấp nhận sai lệch 1")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tạo baseline nháp" })).toBeDisabled();
  });

  it("cho phép lưu quyết định trên baseline nháp hiện có", () => {
    const draft = {
      id: 7,
      version: 2,
      name: "Baseline nháp",
      status: "draft",
      created_at: null,
      approved_at: null,
      open_issues: [issue],
    } as ProjectBaseline;
    const props = setup({ baselines: [draft] });
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh quyết định" }));
    expect(screen.getByText(/Snapshot dữ liệu không thay đổi/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Lưu quyết định" }));
    expect(props.onSaveIssues).toHaveBeenCalledWith(7, [issue]);
  });

  it("chỉ hiển thị xuất SRS cho baseline đã duyệt", () => {
    const approved = {
      id: 8,
      version: 3,
      name: "Baseline chính thức",
      status: "approved",
      created_at: null,
      approved_at: null,
      open_issues: [],
    } as ProjectBaseline;
    const props = setup({ baselines: [approved] });
    fireEvent.click(screen.getByRole("button", { name: "Xuất SRS DOCX" }));
    expect(props.onExport).toHaveBeenCalledWith(8);
  });
});
