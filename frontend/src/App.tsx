import { useState } from "react";
import Stepper from "./components/Stepper";
import { useAuth } from "./auth/AuthContext";
import LoginPage from "./auth/LoginPage";
import HomePage from "./components/home/HomePage";
import {
  loadProjects,
  saveProjects,
  toNumericId,
  type Project,
} from "./components/home/projectStore";
import Step1Requirement, {
  type Specification,
} from "./components/step1/Step1Requirement";
import Step2UseCase from "./components/Step2UseCase";
import Step3DiagramBuilder from "./components/Step3DiagramBuilder";

interface UseCase {
  id: number;
  specId: number;
  name: string;
  mainFlow: string[];
  altFlows: string[];
  diagramGenerated: boolean;
}

function App() {
  const { user, loading, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [specs, setSpecs] = useState<Specification[]>([]);
  const [useCases, setUseCases] = useState<UseCase[]>([]);

  const persist = (next: Project[]) => {
    setProjects(next);
    saveProjects(next);
  };

  const handleOpenProject = (project: Project) => {
    // Nếu là dự án mới chưa có trong danh sách thì thêm vào.
    if (!projects.some((p) => p.id === project.id)) {
      persist([...projects, project]);
    }
    setActiveProject(project);
    setStep(1);
    setSpecs([]);
    setUseCases([]);
  };

  const handleDeleteProject = (id: string) => {
    persist(projects.filter((p) => p.id !== id));
  };

  const handleBackHome = () => {
    setActiveProject(null);
    setStep(1);
    setSpecs([]);
    setUseCases([]);
  };

  // 0) Cổng đăng nhập: chưa đăng nhập thì chặn toàn bộ app.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Đang kiểm tra đăng nhập...</p>
      </div>
    );
  }
  if (!user) {
    return <LoginPage />;
  }

  // 1) Trang chủ: chọn / tạo dự án
  if (!activeProject) {
    return (
      <HomePage
        projects={projects}
        onOpen={handleOpenProject}
        onDelete={handleDeleteProject}
      />
    );
  }

  // 2) Workspace: luồng 3 bước
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 flex items-center justify-between gap-3 py-3">
          <button
            type="button"
            onClick={handleBackHome}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-violet-600"
          >
            ← Trang chủ
          </button>
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 text-right">
              <span className="block text-sm font-semibold text-slate-900 truncate">
                {activeProject.name}
              </span>
              <span className="block text-xs text-slate-400 truncate">
                {activeProject.description || "Không có mô tả"}
              </span>
            </div>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              {user.avatar_url && (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="h-8 w-8 rounded-full"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="hidden sm:block text-xs text-slate-600 max-w-35 truncate">
                {user.name || user.email}
              </span>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </div>

      <Stepper current={step} onStepClick={setStep} />

      {step === 1 && (
        <Step1Requirement
          projectId={toNumericId(activeProject.id)}
          onContinue={(s: Specification[]) => {
            setSpecs(s);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <Step2UseCase
          specs={specs}
          onBack={() => setStep(1)}
          onContinue={(uc) => {
            setUseCases(uc);
            setStep(3);
          }}
        />
      )}

      {step === 3 && (
        <Step3DiagramBuilder
          useCases={useCases}
          onBack={() => setStep(2)}
        />
      )}
    </div>
  );
}

export default App;