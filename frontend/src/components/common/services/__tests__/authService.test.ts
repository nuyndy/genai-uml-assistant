import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authHeaders,
  clearToken,
  fetchCurrentUser,
  getToken,
  loginWithGoogle,
  setToken,
} from "../authService";

const TOKEN_KEY = "genai-uml:token";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("token storage", () => {
  it("setToken/getToken/clearToken hoạt động đúng", () => {
    expect(getToken()).toBeNull();
    setToken("abc");
    expect(getToken()).toBe("abc");
    clearToken();
    expect(getToken()).toBeNull();
  });
});

describe("authHeaders", () => {
  it("trả về object rỗng khi chưa có token", () => {
    expect(authHeaders()).toEqual({});
  });

  it("trả về header Bearer khi đã có token", () => {
    setToken("tok-abc");
    expect(authHeaders()).toEqual({ Authorization: "Bearer tok-abc" });
  });

  it("coi token chuỗi rỗng như chưa đăng nhập (không gửi Bearer rỗng)", () => {
    setToken("");
    expect(authHeaders()).toEqual({});
  });
});

describe("loginWithGoogle", () => {
  it("lưu token và trả về user khi backend 200", async () => {
    const user = { id: 1, email: "u@e.com", name: null, avatar_url: null };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "tok-1", user }),
      } as unknown as Response),
    );

    const result = await loginWithGoogle("cred");

    expect(result).toEqual(user);
    expect(localStorage.getItem(TOKEN_KEY)).toBe("tok-1");
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/auth/google",
      expect.objectContaining({ method: "POST" }),
    );
    vi.unstubAllGlobals();
  });

  it("ném lỗi kết nối khi fetch reject", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(loginWithGoogle("cred")).rejects.toThrow(
      /Không kết nối được backend tại http:\/\/localhost:8000/,
    );
    vi.unstubAllGlobals();
  });

  it("dùng detail từ body khi backend trả lỗi JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Token Google hết hạn." }),
      } as unknown as Response),
    );

    await expect(loginWithGoogle("cred")).rejects.toThrow(
      "Token Google hết hạn.",
    );
    vi.unstubAllGlobals();
  });

  it("dùng message HTTP mặc định khi body lỗi không parse được", async () => {
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

    await expect(loginWithGoogle("cred")).rejects.toThrow(
      /Đăng nhập thất bại \(HTTP 500\)/,
    );
    vi.unstubAllGlobals();
  });

  it("dùng message HTTP mặc định khi body lỗi không có detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({}),
      } as unknown as Response),
    );

    await expect(loginWithGoogle("cred")).rejects.toThrow(
      /Đăng nhập thất bại \(HTTP 403\)/,
    );
    vi.unstubAllGlobals();
  });
});

describe("fetchCurrentUser", () => {
  it("trả null ngay khi không có token (không gọi mạng)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCurrentUser()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("trả về user khi token hợp lệ", async () => {
    setToken("tok");
    const user = { id: 2, email: "me@e.com", name: "Me", avatar_url: null };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => user,
      } as unknown as Response),
    );

    await expect(fetchCurrentUser()).resolves.toEqual(user);
    vi.unstubAllGlobals();
  });

  it("gửi kèm Authorization Bearer header", async () => {
    setToken("tok-xyz");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, email: "e", name: null, avatar_url: null }),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    await fetchCurrentUser();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/auth/me",
      expect.objectContaining({
        headers: { Authorization: "Bearer tok-xyz" },
      }),
    );
    vi.unstubAllGlobals();
  });

  it("xoá token và trả null khi backend trả 401", async () => {
    setToken("tok");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response),
    );

    await expect(fetchCurrentUser()).resolves.toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    vi.unstubAllGlobals();
  });

  it("trả null (giữ token) khi fetch ném lỗi mạng", async () => {
    setToken("tok");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(fetchCurrentUser()).resolves.toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBe("tok");
    vi.unstubAllGlobals();
  });
});
