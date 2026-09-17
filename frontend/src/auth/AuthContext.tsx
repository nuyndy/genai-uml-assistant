import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  clearToken,
  fetchCurrentUser,
  loginWithGoogle,
  type AuthUser,
} from "../services/authService";
import { AUTH_EXPIRED_EVENT } from "../services/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (credential: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => setUser(u))
      // .finally() không bắt được lỗi nên promise sẽ reject "trần" và sinh
      // unhandledRejection; thêm .catch để nuốt lỗi (đã log) rồi mới tắt loading.
      .catch((err) => {
        console.error("Không tải được thông tin người dùng:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  // Bất kỳ request nào bị 401 (token hết hạn) đều phát sự kiện này -> tự đăng xuất.
  useEffect(() => {
    const handleExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, []);

  const login = async (credential: string) => {
    const u = await loginWithGoogle(credential);
    setUser(u);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth phải được dùng bên trong <AuthProvider>.");
  }
  return ctx;
}
