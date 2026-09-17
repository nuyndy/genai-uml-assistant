import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../AuthContext";
import type { AuthUser } from "../../services/authService";
import { AUTH_EXPIRED_EVENT } from "../../services/api";

vi.mock("../../services/authService", () => ({
  API_BASE: "http://localhost:8000",
  authHeaders: vi.fn(() => ({})),
  loginWithGoogle: vi.fn(),
  fetchCurrentUser: vi.fn(),
  clearToken: vi.fn(),
  getToken: vi.fn(),
  setToken: vi.fn(),
}));

import {
  clearToken,
  fetchCurrentUser,
  loginWithGoogle,
} from "../../services/authService";

const mockFetchCurrentUser = vi.mocked(fetchCurrentUser);
const mockLoginWithGoogle = vi.mocked(loginWithGoogle);
const mockClearToken = vi.mocked(clearToken);

const USER: AuthUser = {
  id: 7,
  email: "user@example.com",
  name: "User",
  avatar_url: null,
};

/** Component phơi bày giá trị context ra DOM để kiểm tra. */
function Probe() {
  const { user, loading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.email : "none"}</span>
      <button type="button" onClick={() => login("cred").catch(() => {})}>
        login
      </button>
      <button type="button" onClick={logout}>
        logout
      </button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAuth – Rules of Hooks", () => {
  it("ném lỗi rõ ràng khi dùng ngoài <AuthProvider>", () => {
    // Chặn console.error ồn ào từ React khi cây component throw.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    function Broken() {
      useAuth();
      return null;
    }

    expect(() => render(<Broken />)).toThrow(
      /useAuth phải được dùng bên trong <AuthProvider>./,
    );

    spy.mockRestore();
  });
});

describe("AuthProvider – trạng thái khởi tạo", () => {
  it("loading=true khi đang kiểm tra, sau đó false và gán user", async () => {
    mockFetchCurrentUser.mockResolvedValue(USER);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId("loading").textContent).toBe("true");

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );
    expect(screen.getByTestId("user").textContent).toBe("user@example.com");
  });

  it("user=null khi chưa đăng nhập (fetch trả null)", async () => {
    mockFetchCurrentUser.mockResolvedValue(null);
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("vẫn tắt loading khi fetchCurrentUser ném lỗi (nhánh .finally)", async () => {
    // AuthProvider có .catch() nên lỗi được nuốt và log ra console;
    // đồng thời .finally() phải luôn tắt loading.
    mockFetchCurrentUser.mockRejectedValue(new Error("mất mạng"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );
    expect(screen.getByTestId("user").textContent).toBe("none");
    // Lỗi được log chứ không bị nuốt âm thầm.
    expect(errorSpy).toHaveBeenCalledWith(
      "Không tải được thông tin người dùng:",
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });
});

describe("AuthProvider – login", () => {
  it("cập nhật user khi login thành công", async () => {
    mockFetchCurrentUser.mockResolvedValue(null);
    mockLoginWithGoogle.mockResolvedValue(USER);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );

    await act(async () => {
      screen.getByText("login").click();
    });

    expect(mockLoginWithGoogle).toHaveBeenCalledWith("cred");
    expect(screen.getByTestId("user").textContent).toBe("user@example.com");
  });

  it("giữ nguyên user cũ khi login thất bại", async () => {
    mockFetchCurrentUser.mockResolvedValue(null);
    mockLoginWithGoogle.mockRejectedValue(new Error("sai credential"));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );

    await act(async () => {
      screen.getByText("login").click();
    });

    expect(screen.getByTestId("user").textContent).toBe("none");
  });
});

describe("AuthProvider – logout", () => {
  it("xoá token và đặt user về null", async () => {
    mockFetchCurrentUser.mockResolvedValue(USER);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("user@example.com"),
    );

    act(() => {
      screen.getByText("logout").click();
    });

    expect(mockClearToken).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("logout khi chưa có user vẫn an toàn (idempotent)", async () => {
    mockFetchCurrentUser.mockResolvedValue(null);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );

    act(() => {
      screen.getByText("logout").click();
    });
    act(() => {
      screen.getByText("logout").click();
    });

    expect(mockClearToken).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("user").textContent).toBe("none");
  });
});

describe("AuthProvider – phiên hết hạn (AUTH_EXPIRED_EVENT)", () => {
  it("tự đặt user về null khi nhận sự kiện 401", async () => {
    mockFetchCurrentUser.mockResolvedValue(USER);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("user@example.com"),
    );

    act(() => {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    });

    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("gỡ listener khi unmount (không rò rỉ, không setState sau khi gỡ)", async () => {
    mockFetchCurrentUser.mockResolvedValue(USER);

    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("user@example.com"),
    );

    unmount();

    // Sau khi unmount, phát sự kiện không được gây lỗi/cảnh báo.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    act(() => {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
