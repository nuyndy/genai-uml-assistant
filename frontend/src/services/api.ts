import { API_BASE, authHeaders, clearToken } from "./authService";

/**
 * Lỗi HTTP có kèm mã trạng thái để nơi gọi phân biệt 401 / 422 / 5xx.
 */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Sự kiện phát ra khi backend trả 401 (token hết hạn / không hợp lệ).
 * AuthContext lắng nghe để tự đăng xuất, tránh giữ phiên "treo".
 */
export const AUTH_EXPIRED_EVENT = "genai-uml:auth-expired";

function emitAuthExpired(): void {
  clearToken();
  // jsdom (test) cũng có window.dispatchEvent nên không cần guard đặc biệt.
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

/**
 * Gọi API kèm Authorization: Bearer <token> và tự xử lý lỗi chung.
 *
 * - Tự đính token hiện có (nếu chưa đăng nhập, backend sẽ trả 401).
 * - 401 -> xoá token + phát sự kiện AUTH_EXPIRED_EVENT, rồi ném ApiError.
 * - Các lỗi khác -> ném ApiError kèm `detail` do backend trả về (nếu có).
 * - Lỗi mạng -> ném ApiError với thông báo thân thiện.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...authHeaders(),
    ...(options.headers ?? {}),
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      0,
      `Không kết nối được backend tại ${API_BASE}. Hãy chắc chắn server đang chạy.`,
    );
  }

  if (res.status === 401) {
    emitAuthExpired();
    throw new ApiError(401, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }

  if (!res.ok) {
    let detail = `Yêu cầu thất bại (HTTP ${res.status}).`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      // Body không phải JSON -> giữ thông báo mặc định.
    }
    throw new ApiError(res.status, detail);
  }

  // 204 No Content hoặc body rỗng -> trả undefined an toàn.
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function apiFetchBlob(
  path: string,
  options: RequestInit = {},
): Promise<{ blob: Blob; filename: string }> {
  const headers: HeadersInit = {
    ...authHeaders(),
    ...(options.headers ?? {}),
  };
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      0,
      `Không kết nối được backend tại ${API_BASE}. Hãy chắc chắn server đang chạy.`,
    );
  }
  if (res.status === 401) {
    emitAuthExpired();
    throw new ApiError(401, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }
  if (!res.ok) {
    let detail = `Yêu cầu thất bại (HTTP ${res.status}).`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      // Server returned a non-JSON error body.
    }
    throw new ApiError(res.status, detail);
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const encodedName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  return {
    blob: await res.blob(),
    filename: encodedName ?? "SRS",
  };
}
