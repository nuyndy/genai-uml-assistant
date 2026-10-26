import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, AUTH_EXPIRED_EVENT, apiFetch } from "../api";
import { getToken, setToken } from "../authService";

const TOKEN_KEY = "genai-uml:token";

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

describe("apiFetch – đính kèm Authorization", () => {
  it("gửi kèm Bearer token khi đã đăng nhập", async () => {
    setToken("tok-1");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 5 }));
    vi.stubGlobal("fetch", fetchMock);

    const data = await apiFetch<{ id: number }>("/api/projects/7/requirements", {
      method: "POST",
      body: JSON.stringify({ a: 1 }),
    });

    expect(data).toEqual({ id: 5 });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/projects/7/requirements",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer tok-1" }),
      }),
    );
  });

  it("không gửi Authorization khi chưa có token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/projects/7/requirements");

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("mặc định Content-Type là application/json", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/x");

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("gộp headers tùy chỉnh truyền vào (không làm mất Authorization)", async () => {
    setToken("tok-1");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    const custom: RequestInit = { headers: { "X-Custom": "abc" } };
    await apiFetch("/x", custom);

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["X-Custom"]).toBe("abc");
    expect(headers.Authorization).toBe("Bearer tok-1");
  });
});

describe("apiFetch – thành công", () => {
  it("trả về undefined khi 204 No Content (không parse body)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response),
    );

    await expect(apiFetch("/x")).resolves.toBeUndefined();
  });

  it("trả về undefined khi body rỗng", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "",
      } as unknown as Response),
    );

    await expect(apiFetch("/x")).resolves.toBeUndefined();
  });
});

describe("apiFetch – lỗi 401", () => {
  it("xoá token và phát sự kiện AUTH_EXPIRED khi backend trả 401", async () => {
    setToken("tok-cu");
    const onExpired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ detail: "hết hạn" }, 401)),
    );

    await expect(apiFetch("/api/projects/7/requirements")).rejects.toBeInstanceOf(ApiError);
    expect(getToken()).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  });

  it("ném ApiError với status 401 và thông báo thân thiện", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 401)));

    await expect(apiFetch("/x")).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining("Phiên đăng nhập đã hết hạn"),
    });
  });
});

describe("apiFetch – các lỗi khác", () => {
  it("dùng detail từ body khi backend trả lỗi JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ detail: "Thiếu dữ liệu." }, 422));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/x")).rejects.toMatchObject({
      status: 422,
      message: "Thiếu dữ liệu.",
    });
    // Không phải 401 -> token vẫn còn.
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("dùng thông báo mặc định khi body JSON lỗi không có detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "khác" }, 400)),
    );

    await expect(apiFetch("/x")).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("Yêu cầu thất bại (HTTP 400)"),
    });
  });

  it("dùng thông báo mặc định khi body lỗi không phải JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("not json");
        },
      } as unknown as Response),
    );

    await expect(apiFetch("/x")).rejects.toMatchObject({
      status: 500,
      message: expect.stringContaining("Yêu cầu thất bại (HTTP 500)"),
    });
  });

  it("ném ApiError status 0 khi fetch reject (lỗi mạng)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(apiFetch("/x")).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("Không kết nối được backend"),
    });
  });
});
