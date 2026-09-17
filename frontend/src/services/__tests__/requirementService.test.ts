import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveRequirement } from "../requirementService";
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

describe("saveRequirement", () => {
  it("POST tới /api/requirements kèm Bearer token và payload", async () => {
    setToken("tok-1");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: "Lưu thành công", id: 42 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveRequirement({
      project_id: 7,
      actor: "Khách",
      feature: "Đặt hàng",
      benefit: "Mua được sản phẩm",
    });

    expect(result).toEqual({ message: "Lưu thành công", id: 42 });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/requirements",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer tok-1" }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      project_id: 7,
      actor: "Khách",
      feature: "Đặt hàng",
      benefit: "Mua được sản phẩm",
    });
  });

  it("ném lỗi khi backend trả 401 (token hết hạn)", async () => {
    setToken("tok-cu");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ detail: "hết hạn" }, 401)),
    );

    await expect(
      saveRequirement({
        project_id: 1,
        actor: "a",
        feature: "f",
        benefit: "b",
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
});
