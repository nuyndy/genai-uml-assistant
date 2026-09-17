import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resp: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const { login } = useAuth();
  const btnRef = useRef<HTMLDivElement>(null);
  // Lỗi cấu hình đã biết ngay từ lúc khởi tạo, không cần setState trong effect.
  const [error, setError] = useState(
    GOOGLE_CLIENT_ID
      ? ""
      : "Chưa cấu hình VITE_GOOGLE_CLIENT_ID. Hãy thêm vào file .env của frontend.",
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const init = () => {
      if (!window.google || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp) => {
          try {
            setError("");
            await login(resp.credential);
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Đăng nhập thất bại. Vui lòng thử lại.",
            );
          }
        },
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
        width: 280,
      });
    };

    if (window.google) {
      init();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = init;
      document.body.appendChild(script);
    }
  }, [login]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border-slate-200 bg-white p-8 shadow-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            GenAI UML Assistant
          </h1>
          <p className="text-sm text-slate-500">
            Đăng nhập để bắt đầu quản lý dự án của bạn.
          </p>
        </div>

        <div className="flex justify-center" ref={btnRef} />

        {error && (
          <div className="rounded-xl border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
