import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../LoginPage";
import { AuthProvider, useAuth } from "../AuthContext";

// ---------------------------------------------------------------------------
// Mock lớp service để không gọi mạng thật.
// ---------------------------------------------------------------------------
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
  fetchCurrentUser,
  loginWithGoogle,
  type AuthUser,
} from "../../services/authService";

const mockLoginWithGoogle = vi.mocked(loginWithGoogle);
const mockFetchCurrentUser = vi.mocked(fetchCurrentUser);

// ---------------------------------------------------------------------------
// Kiểu mô phỏng Google Identity Services (GIS).
// ---------------------------------------------------------------------------
interface FakeGoogleHandlers {
  initialized?: {
    client_id: string;
    callback: (resp: { credential: string }) => void;
  };
  rendered?: { parent: HTMLElement; options: Record<string, unknown> };
}

function setupGoogleMock(handlers: FakeGoogleHandlers = {}) {
  const initialize = vi.fn(
    (config: {
      client_id: string;
      callback: (resp: { credential: string }) => void;
    }) => {
      handlers.initialized = config;
    },
  );
  const renderButton = vi.fn(
    (parent: HTMLElement, options: Record<string, unknown>) => {
      handlers.rendered = { parent, options };
    },
  );

  window.google = {
    accounts: { id: { initialize, renderButton } },
  };
  return { initialize, renderButton };
}

/** Render LoginPage bên trong AuthProvider (giống thực tế ở main.tsx). */
async function renderWithProvider() {
  mockFetchCurrentUser.mockResolvedValue(null);
  const view = render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
  );
  // Chờ AuthProvider thoát trạng thái loading.
  await waitFor(() => expect(mockFetchCurrentUser).toHaveBeenCalled());
  return view;
}

const USER: AuthUser = {
  id: 1,
  email: "a@example.com",
  name: "A",
  avatar_url: null,
};

/**
 * LoginPage đọc VITE_GOOGLE_CLIENT_ID ở phạm vi module nên vi.stubEnv không
 * thể thay đổi giá trị đã bị "đóng băng" lúc transform. Ta dùng chính giá trị
 * thực mà Vite nạp vào tiến trình test (từ .env hoặc từ môi trường).
 */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

let lastScript: HTMLScriptElement | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  lastScript = null;
  delete window.google;

  // Chặn appendChild để bắt được <script> mà component tự tạo.
  const originalAppend = document.body.appendChild.bind(document.body);
  vi.spyOn(document.body, "appendChild").mockImplementation(((node: Node) => {
    if (node instanceof HTMLScriptElement) {
      lastScript = node;
      return node; // không thực sự chèn -> không tải mạng
    }
    return originalAppend(node);
  }) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LoginPage – nội dung cơ bản luôn hiển thị", () => {
  it("render tiêu đề và lời nhắc đăng nhập", async () => {
    setupGoogleMock();
    await renderWithProvider();

    expect(
      screen.getByRole("heading", { name: /GenAI UML Assistant/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Đăng nhập để bắt đầu quản lý dự án/i),
    ).toBeInTheDocument();
  });
});

describe("LoginPage – khởi tạo Google Identity Services", () => {
  it.skipIf(!CLIENT_ID)(
    "dùng window.google có sẵn (không thêm script) và render button",
    async () => {
      const { initialize, renderButton } = setupGoogleMock();

      await renderWithProvider();

      await waitFor(() => expect(initialize).toHaveBeenCalled());
      expect(initialize).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: CLIENT_ID }),
      );
      expect(renderButton).toHaveBeenCalled();
      expect(renderButton).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "pill",
          width: 280,
        }),
      );
      // Không cần tải script vì window.google đã có.
      expect(lastScript).toBeNull();
    },
  );

  it.skipIf(!CLIENT_ID)(
    "tự thêm <script> khi chưa có window.google rồi khởi tạo ở sự kiện onload",
    async () => {
      delete window.google;

      await renderWithProvider();

      await waitFor(() => expect(lastScript).not.toBeNull());
      expect(lastScript!.src).toBe("https://accounts.google.com/gsi/client");
      expect(lastScript!.async).toBe(true);
      expect(lastScript!.defer).toBe(true);

      // Google chưa nạp -> chưa được initialize.
      expect(window.google).toBeUndefined();

      // Mô phỏng script tải xong.
      const { initialize, renderButton } = setupGoogleMock();
      lastScript!.onload!(new Event("load"));

      expect(initialize).toHaveBeenCalledTimes(1);
      expect(renderButton).toHaveBeenCalledTimes(1);
    },
  );

  it("onload chạy nhưng window.google vẫn chưa sẵn sàng -> bỏ qua an toàn", async () => {
    delete window.google;
    await renderWithProvider();
    await waitFor(() => expect(lastScript).not.toBeNull());

    // Không gán window.google rồi kích hoạt onload.
    expect(() => lastScript!.onload!(new Event("load"))).not.toThrow();
    expect(screen.queryByText(/thất bại/i)).not.toBeInTheDocument();
  });

  it("component không gán onerror cho script (lỗi tải do GIS tự xử lý)", async () => {
    delete window.google;
    await renderWithProvider();
    await waitFor(() => expect(lastScript).not.toBeNull());

    // Component chỉ quan tâm onload; không có handler onerror nào được gán.
    expect(lastScript!.onerror).toBeNull();
    expect(
      screen.getByRole("heading", { name: /GenAI UML Assistant/i }),
    ).toBeInTheDocument();
  });
});

describe("LoginPage – xử lý callback đăng nhập", () => {
  it("đăng nhập thành công: gọi login với credential, không hiện lỗi", async () => {
    mockLoginWithGoogle.mockResolvedValue(USER);
    const handlers: FakeGoogleHandlers = {};
    setupGoogleMock(handlers);

    await renderWithProvider();
    await waitFor(() => expect(handlers.initialized).toBeDefined());

    await act(async () => {
      handlers.initialized!.callback({ credential: "cred-123" });
    });

    await waitFor(() =>
      expect(mockLoginWithGoogle).toHaveBeenCalledWith("cred-123"),
    );
    expect(screen.queryByText(/thất bại/i)).not.toBeInTheDocument();
  });

  it("đăng nhập thất bại: hiển thị đúng message từ Error", async () => {
    mockLoginWithGoogle.mockRejectedValue(
      new Error("Tài khoản không hợp lệ."),
    );
    const handlers: FakeGoogleHandlers = {};
    setupGoogleMock(handlers);

    await renderWithProvider();
    await waitFor(() => expect(handlers.initialized).toBeDefined());

    await act(async () => {
      handlers.initialized!.callback({ credential: "bad" });
    });

    expect(
      await screen.findByText("Tài khoản không hợp lệ."),
    ).toBeInTheDocument();
  });

  it("đăng nhập thất bại với giá trị KHÔNG phải Error -> dùng message mặc định", async () => {
    // ví dụ backend throw string/object thay vì Error.
    mockLoginWithGoogle.mockRejectedValue("boom");
    const handlers: FakeGoogleHandlers = {};
    setupGoogleMock(handlers);

    await renderWithProvider();
    await waitFor(() => expect(handlers.initialized).toBeDefined());

    await act(async () => {
      handlers.initialized!.callback({ credential: "bad" });
    });

    expect(
      await screen.findByText(/Đăng nhập thất bại. Vui lòng thử lại./i),
    ).toBeInTheDocument();
  });

  it("lỗi cũ được xoá khi lần đăng nhập kế tiếp thành công", async () => {
    mockLoginWithGoogle.mockRejectedValueOnce(new Error("Lỗi lần 1."));
    mockLoginWithGoogle.mockResolvedValueOnce(USER);
    const handlers: FakeGoogleHandlers = {};
    setupGoogleMock(handlers);

    await renderWithProvider();
    await waitFor(() => expect(handlers.initialized).toBeDefined());

    await act(async () => {
      handlers.initialized!.callback({ credential: "1" });
    });
    expect(await screen.findByText("Lỗi lần 1.")).toBeInTheDocument();

    await act(async () => {
      handlers.initialized!.callback({ credential: "2" });
    });
    await waitFor(() =>
      expect(screen.queryByText("Lỗi lần 1.")).not.toBeInTheDocument(),
    );
  });

  it("callback gọi được nhiều lần mà không làm treo UI", async () => {
    mockLoginWithGoogle.mockResolvedValue(USER);
    const handlers: FakeGoogleHandlers = {};
    setupGoogleMock(handlers);

    await renderWithProvider();
    await waitFor(() => expect(handlers.initialized).toBeDefined());

    await act(async () => {
      handlers.initialized!.callback({ credential: "a" });
      handlers.initialized!.callback({ credential: "b" });
    });

    await waitFor(() =>
      expect(mockLoginWithGoogle).toHaveBeenCalledTimes(2),
    );
  });
});

describe("LoginPage – tích hợp với useAuth trong AuthProvider", () => {
  it("login thành công cập nhật user trong context", async () => {
    mockLoginWithGoogle.mockResolvedValue(USER);

    function Consumer() {
      const { user, loading } = useAuth();
      return (
        <div>
          <span data-testid="loading">{String(loading)}</span>
          <span data-testid="email">{user?.email ?? "none"}</span>
        </div>
      );
    }

    const handlers: FakeGoogleHandlers = {};
    setupGoogleMock(handlers);
    mockFetchCurrentUser.mockResolvedValue(null);

    render(
      <AuthProvider>
        <LoginPage />
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );
    expect(screen.getByTestId("email").textContent).toBe("none");

    await waitFor(() => expect(handlers.initialized).toBeDefined());
    await act(async () => {
      handlers.initialized!.callback({ credential: "cred" });
    });

    await waitFor(() =>
      expect(screen.getByTestId("email").textContent).toBe("a@example.com"),
    );
  });

  it("LoginPage nm trong AuthProvider nên không ném lỗi Rules of Hooks", async () => {
    setupGoogleMock();
    const { container } = await renderWithProvider();

    // Component phải render ra DOM thật, không bị React unmount do throw.
    expect(container.querySelector("div")).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: /GenAI UML Assistant/i }),
    ).toBeInTheDocument();
  });
});

describe("LoginPage – thiếu VITE_GOOGLE_CLIENT_ID (kiểm tra qua mã nguồn)", () => {
  it("nhánh thiếu cấu hình dùng setError, không gọi useAuth như hàm thường", async () => {
    // VITE_GOOGLE_CLIENT_ID được đọc ở phạm vi module nên không thể stub lại
    // trong test. Ta xác nhận nhánh thiếu cấu hình được viết đúng (đây chính
    // là regression test cho bug 'useAuth\(...\)' khiến màn hình trắng).
    const source = await import("../LoginPage.tsx?raw").then(
      (m) => (m as { default: string }).default,
    );
    expect(source).toContain("Chưa cấu hình VITE_GOOGLE_CLIENT_ID");
    expect(source).not.toMatch(/useAuth\s*\(\s*["']/);
  });
});
