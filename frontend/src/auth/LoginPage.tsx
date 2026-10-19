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
    <div className="relative min-h-screen overflow-hidden bg-white px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-36 h-96 w-96 rounded-full bg-violet-200/50 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-28 h-96 w-96 rounded-full bg-indigo-100/70 blur-3xl"
      />
      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl items-center gap-10 lg:grid-cols-2">
        <section className="space-y-7 text-center lg:text-left">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500 text-xl font-bold text-white shadow-lg shadow-violet-200 lg:mx-0">
            U
          </div>
          <div className="space-y-4">
            <h1 className="text-sm font-semibold tracking-wide text-violet-700">
              GenAI UML Assistant
            </h1>
            <h2 className="text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Biến yêu cầu thành mô hình UML
            </h2>
            <p className="mx-auto max-w-xl text-base leading-7 text-slate-600 lg:mx-0">
              Thu thập yêu cầu, xây dựng đặc tả và phát triển các sơ đồ UML
              trong một không gian dự án thống nhất.
            </p>
          </div>
          <div className="mx-auto grid max-w-xl grid-cols-1 gap-3 text-left sm:grid-cols-3 lg:mx-0">
            {[
              ["01", "Yêu cầu", "Ghi nhận và phân tích"],
              ["02", "Đặc tả", "Tổ chức chức năng"],
              ["03", "Mô hình", "Sinh sơ đồ UML"],
            ].map(([number, title, description]) => (
              <div
                key={number}
                className="rounded-2xl border border-slate-200 bg-sky-50/70 p-4 shadow-sm"
              >
                <p className="text-xs font-semibold text-violet-600">{number}</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {title}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/70 sm:p-9">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Chào mừng bạn
            </h2>
            <p className="text-sm leading-6 text-slate-500">
              Đăng nhập bằng Google để mở không gian dự án của bạn.
            </p>
          </div>

          <div className="mt-7 flex min-h-11 justify-center" ref={btnRef} />

          {error && (
            <div
              role="alert"
              className="mt-5 break-words rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm leading-6 text-rose-700"
            >
              {error}
            </div>
          )}

          <p className="mt-7 border-t border-slate-100 pt-5 text-center text-xs leading-5 text-slate-400">
            Tài khoản được dùng để quản lý quyền sở hữu các dự án.
          </p>
        </section>
      </div>
    </div>
  );
}
