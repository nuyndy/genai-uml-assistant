export const API_BASE = "http://localhost:8000";
const TOKEN_KEY = "genai-uml:token";

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function loginWithGoogle(credential: string): Promise<AuthUser> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
  } catch {
    throw new Error(
      `Không kết nối được backend tại ${API_BASE}. Hãy chắc chắn server đang chạy.`,
    );
  }

  if (!res.ok) {
    let detail = `Đăng nhập thất bại (HTTP ${res.status}).`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      //Bỏ qua
    }
    throw new Error(detail);
  }

  const data = await res.json();
  setToken(data.access_token);
  return data.user as AuthUser;
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  if (!getToken()) return null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      clearToken();
      return null;
    }
    return (await res.json()) as AuthUser;
  } catch {
    return null;
  }
}
