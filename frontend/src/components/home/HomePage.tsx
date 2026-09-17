import { useState } from "react";
import { createProject, type Project } from "./projectStore";

interface Props {
  projects: Project[];
  onOpen: (project: Project) => void;
  onDelete: (id: string) => void;
}

const inputClass =
  "w-full rounded-lg border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100";

/** Trang chủ: chọn một dự án có sẵn hoặc tạo dự án mới trước khi vào workspace. */
export default function HomePage({ projects, onOpen, onDelete }: Props) {
  const [mode, setMode] = useState<"list" | "create">(
    projects.length === 0 ? "create" : "list",
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const handleCreate = () => {
    if (!name.trim()) {
      setError("Vui lòng nhập tên dự án.");
      return;
    }
    setError("");
    const project = createProject(name, description);
    setName("");
    setDescription("");
    onOpen(project);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-8">
        {/* Tiêu đề */}
        <header className="text-center space-y-3">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            GenAI UML Assistant
          </h1>
          <p className="text-sm text-slate-500">
            Chọn một dự án để tiếp tục hoặc tạo dự án mới để bắt đầu.
          </p>
        </header>

        {/* Thanh chuyển chế độ */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-xl border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setMode("list")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                mode === "list"
                  ? "bg-violet-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Dự án của tôi ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                mode === "create"
                  ? "bg-violet-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              + Tạo dự án mới
            </button>
          </div>
        </div>

        {/* Nội dung */}
        {mode === "list" ? (
          <section className="space-y-4">
            {projects.length === 0 ? (
              <div className="rounded-2xl border-dashed border-slate-200 bg-white p-12 text-center">
                <p className="text-sm text-slate-400">
                  Chưa có dự án nào. Hãy chuyển sang tab "Tạo dự án mới".
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="group rounded-2xl border-slate-200 bg-white p-5 shadow-sm space-y-3 transition hover:border-violet-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-semibold text-slate-900 break-words">
                        {project.name}
                      </h3>
                      <button
                        type="button"
                        title="Xóa dự án"
                        onClick={() => onDelete(project.id)}
                        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-sm text-slate-500 min-h-[2.5rem] break-words">
                      {project.description || "Không có mô tả."}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-400">
                        Cập nhật{" "}
                        {new Date(project.updatedAt).toLocaleString("vi-VN")}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpen(project)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
                      >
                        Mở dự án →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="mx-auto max-w-xl rounded-2xl border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
              Thông tin dự án mới
            </h2>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Tên dự án <span className="text-violet-500">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Hệ thống Quản lý Thư viện"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Mô tả
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Mô tả ngắn về phạm vi / mục tiêu dự án..."
                className={inputClass}
              />
            </div>

            {error && (
              <div className="rounded-xl border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleCreate}
              className="w-full inline-flex justify-center items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Tạo dự án &amp; bắt đầu
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
