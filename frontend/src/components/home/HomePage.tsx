import { useState } from "react";
import type { AuthUser } from "../../services/authService";
import { createProject, deleteProject, type Project } from "./projectStore";

interface Props {
  projects: Project[];
  user: AuthUser;
  onOpen: (project: Project) => void;
  onDelete: (projectId: number) => void;
  onLogout: () => void;
  loading: boolean;
  loadError: string;
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#D8DDE5] focus:border-[#5E8FDB] focus:ring-2 focus:ring-[#DCEFFF]";
const primaryButtonClass =
  "inline-flex min-h-11 whitespace-nowrap items-center justify-center gap-2 rounded-xl bg-[#294BB6] px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-[#5E8FDB] hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#A8D4FD] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

/** Trang chủ: chọn một dự án có sẵn hoặc tạo dự án mới trước khi vào workspace. */
export default function HomePage({
  projects,
  user,
  onOpen,
  onDelete,
  onLogout,
  loading,
  loadError,
}: Props) {
  const [mode, setMode] = useState<"list" | "create">("list");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Vui lòng nhập tên dự án.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const project = await createProject(name);
      setName("");
      onOpen(project);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? `Không thể tạo dự án: ${reason.message}`
          : "Không thể tạo dự án.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (project: Project) => {
    const confirmed = window.confirm(
      `Xóa dự án "${project.name}" và toàn bộ yêu cầu, đặc tả, use case, lớp và biểu đồ bên trong? Thao tác này không thể hoàn tác.`,
    );
    if (!confirmed) return;

    setError("");
    setDeletingId(project.id);
    try {
      await deleteProject(project.id);
      onDelete(project.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? `Không thể xóa dự án: ${reason.message}`
          : "Không thể xóa dự án.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#DCEFFF] via-[#F3F4F6] to-[#A8D4FD]/40 text-left">
      <nav className="border-b border-[#D8DDE5] bg-white/95 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#294BB6] text-sm font-bold text-white">
              U
            </div>
            <span className="truncate text-sm font-semibold tracking-tight text-slate-900">
              GenAI UML Assistant
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full border border-slate-200"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                {(user.name || user.email).slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="hidden max-w-48 truncate text-sm text-slate-600 sm:block">
              {user.name || user.email}
            </span>
            <span className="mx-1 hidden h-5 border-l border-slate-200 sm:block" />
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-8 px-5 py-9 sm:px-7 sm:py-12">
        <header className="flex flex-col gap-6 pb-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <span>Workspace</span>
              <span aria-hidden="true" className="text-slate-300">/</span>
              <span className="text-[#294BB6]">Dự án</span>
            </div>
            <h1 className="m-0 text-4xl font-semibold leading-tight tracking-[-0.035em] text-slate-900 sm:text-5xl">
              Không gian dự án
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-600">
              Tổ chức yêu cầu, đặc tả và mô hình UML cho từng hệ thống.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError("");
              setMode((current) => (current === "create" ? "list" : "create"));
            }}
            className={`${primaryButtonClass} shrink-0`}
          >
            <span aria-hidden="true" className="text-lg leading-none">+</span>
            {mode === "create" ? "Đóng form" : "Tạo dự án mới"}
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            {error}
          </div>
        )}

        <section aria-label="Danh sách dự án" className="space-y-5">
          {mode === "create" ? (
            <form
              className="rounded-2xl border border-[#D8DDE5] bg-white p-5 shadow-[0_12px_36px_-24px_rgba(41,75,182,0.22)] sm:p-6"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreate();
              }}
            >
              <div className="mb-5">
                <h3 className="m-0 text-base font-semibold text-slate-900">
                  Tạo dự án mới
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Nhập tên hệ thống bạn muốn phân tích và mô hình hóa.
                </p>
              </div>
              <label
                htmlFor="project-name"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Tên dự án <span className="text-[#294BB6]">*</span>
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="project-name"
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="VD: Hệ thống quản lý thư viện"
                  className={inputClass}
                  maxLength={200}
                />
                <button
                  type="submit"
                  disabled={busy || !name.trim()}
                  className={`${primaryButtonClass} min-h-11 shrink-0 sm:min-w-44`}
                >
                  {busy ? "Đang tạo..." : "Tạo và bắt đầu"}
                  {!busy && <span aria-hidden="true">→</span>}
                </button>
              </div>
            </form>
          ) : loadError ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700"
            >
              {loadError}
            </div>
          ) : loading ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {[0, 1].map((item) => (
                <div
                  key={item}
                  className="flex animate-pulse items-center gap-4 px-5 py-5"
                >
                  <div className="h-11 w-11 rounded-xl bg-slate-200" />
                  <div className="flex-1">
                    <div className="h-4 w-2/3 rounded bg-slate-200" />
                    <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#D8DDE5] bg-[#DCEFFF] text-[#1D2E7A]">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-6 w-6"
                >
                  <path
                    d="M4.75 6.75A1.75 1.75 0 0 1 6.5 5h4l1.75 2h5.25a1.75 1.75 0 0 1 1.75 1.75v8.5A1.75 1.75 0 0 1 17.5 19h-11a1.75 1.75 0 0 1-1.75-1.75v-10.5Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 10v5m-2.5-2.5h5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3 className="m-0 mt-4 text-base font-semibold text-slate-900">
                Chưa có dự án
              </h3>
              <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
                Tạo một dự án để bắt đầu phân tích yêu cầu và xây dựng mô hình
                UML.
              </p>
              <button
                type="button"
                onClick={() => setMode("create")}
                className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition duration-200 hover:border-violet-300 hover:bg-[#DCEFFF]"
              >
                Tạo dự án
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="hidden grid-cols-[minmax(0,1fr)_13rem] items-center border-b border-slate-200 bg-sky-50/70 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:grid">
                <span>Dự án / Mã định danh</span>
                <span className="text-right">Thao tác</span>
              </div>
              {projects.map((project, index) => (
                <article
                  key={project.id}
                  className={`grid min-w-0 grid-cols-1 gap-4 px-4 py-5 transition-colors duration-200 hover:bg-slate-50/80 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-center sm:px-6 ${
                    index > 0 ? "border-t border-slate-200" : ""
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D8DDE5] bg-[#DCEFFF] text-base font-semibold text-[#1D2E7A]">
                      {project.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="m-0 break-words text-lg font-semibold leading-7 text-slate-900 [overflow-wrap:anywhere]">
                        {project.name}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                          ID {project.id}
                        </span>
                        {project.created_at && (
                          <>
                            <span>
                              {new Date(project.created_at).toLocaleDateString(
                                "vi-VN",
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => void handleDelete(project)}
                      disabled={busy || deletingId !== null}
                      className="inline-flex h-10 whitespace-nowrap items-center justify-center rounded-xl px-3 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === project.id ? "Đang xóa..." : "Xóa dự án"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpen(project)}
                      disabled={deletingId !== null}
                      className={`${primaryButtonClass} h-10 min-h-10 px-4 text-sm`}
                    >
                      Mở dự án
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
