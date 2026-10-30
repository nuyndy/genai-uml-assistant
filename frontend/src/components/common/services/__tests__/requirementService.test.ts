import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeProjectRequirementsBatch,
  checkProjectRequirementCoverage,
  confirmProjectRequirementsBatch,
  createProjectRequirementsBatch,
  createRequirement,
  generateProjectSpecificationsBatch,
  exportApprovedBaselineSrs,
  previewProjectUserStories,
} from "../requirementService";
import { setToken } from "../authService";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createRequirement", () => {
  it("sends the database requirement fields to the real API", async () => {
    setToken("test-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: 42, status: "draft" }));
    vi.stubGlobal("fetch", fetchMock);

    const payload = {
      actor: "Khách hàng",
      action: "Đặt",
      target_object: "hàng",
      purpose: "Mua sản phẩm",
      pre_conditions: ["Đã đăng nhập"],
      business_rules: ["Đơn hàng có sản phẩm"],
    };
    const result = await createRequirement(7, payload);

    expect(result).toEqual({ id: 42, status: "draft" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/projects/7/requirements",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(payload);
  });

  describe("Stage 1 batch endpoints", () => {
    it("uses the project batch routes and posts confirmed requirement IDs", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
      vi.stubGlobal("fetch", fetchMock);

      await analyzeProjectRequirementsBatch(12);
      await previewProjectUserStories(12);
      const userStories = [
        {
          requirement_id: 4,
          role: "Khách hàng",
          feature: "Đặt đơn hàng",
          benefit: "Mua sản phẩm",
          acceptance_criteria: "Đơn hàng được tạo",
        },
        {
          requirement_id: 5,
          role: "Nhân viên",
          feature: "Cập nhật hồ sơ",
          benefit: "Dữ liệu chính xác",
          acceptance_criteria: "Hồ sơ được cập nhật",
        },
      ];
      await confirmProjectRequirementsBatch(12, [4, 5], userStories);
      await generateProjectSpecificationsBatch(12);
      await checkProjectRequirementCoverage(12);
      await createProjectRequirementsBatch(12, [{
        actor: "Quản trị viên",
        action: "quản lý",
        target_object: "tài khoản",
        purpose: "kiểm soát truy cập",
        pre_conditions: [],
        business_rules: [],
      }]);

      expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        "http://localhost:8000/api/projects/12/requirements/analyze-batch",
        "http://localhost:8000/api/projects/12/requirements/user-stories/preview",
        "http://localhost:8000/api/projects/12/requirements/confirm-batch",
        "http://localhost:8000/api/projects/12/user-stories/generate-specs-batch",
        "http://localhost:8000/api/projects/12/requirements/coverage-check",
        "http://localhost:8000/api/projects/12/requirements/batch",
      ]);
      expect(JSON.parse(fetchMock.mock.calls[2][1].body as string)).toEqual({
        requirement_ids: [4, 5],
        user_stories: userStories,
      });
      expect(fetchMock.mock.calls[4][1]).toMatchObject({ method: "POST" });
      expect(JSON.parse(fetchMock.mock.calls[5][1].body as string)).toEqual({
        requirements: [{
          actor: "Quản trị viên",
          action: "quản lý",
          target_object: "tài khoản",
          purpose: "kiểm soát truy cập",
          pre_conditions: [],
          business_rules: [],
        }],
      });
    });
  });

  it("surfaces authentication errors instead of accepting local data", async () => {
    setToken("expired-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ detail: "expired" }, 401)),
    );

    await expect(
      createRequirement(1, {
        actor: "A",
        action: "B",
        target_object: "C",
        purpose: "D",
        pre_conditions: [],
        business_rules: [],
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe("exportApprovedBaselineSrs", () => {
  it("exports the exact approved baseline snapshot by ID", async () => {
    const blob = new Blob(["docx"]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => name === "content-disposition" ? 'attachment; filename="baseline-4.docx"' : null },
      blob: async () => blob,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await exportApprovedBaselineSrs(9, 4);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/projects/9/specification-document/export?baseline_id=4",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.filename).toBe("baseline-4.docx");
    expect(result.blob).toBe(blob);
  });
});
