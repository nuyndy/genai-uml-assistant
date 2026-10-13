import { useEffect, useState } from "react";
import Stepper from "./components/common/Stepper";
import GiaiDoanStepper from "./components/common/GiaiDoanStepper";
import GiaiDoan1 from "./components/features/giai-doan-1/GiaiDoan1";
import GiaiDoan2 from "./components/features/giai-doan-2/GiaiDoan2";
import GiaiDoan3 from "./components/features/giai-doan-3/GiaiDoan3";
import { useAuth } from "./auth/AuthContext";
import LoginPage from "./auth/LoginPage";
import HomePage from "./components/home/HomePage";
import {
  listProjects,
  type Project,
} from "./components/home/projectStore";
import { STAGES, type StageId } from "./stages";
import { StageBackdrop } from "./components/common/ui/primitives";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { emptyWorkflow, type WorkflowState } from "./types/workflow";

function App() {
  const { user, loading, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoadedFor, setProjectsLoadedFor] = useState<number | null>(null);
  const [projectsError, setProjectsError] = useState("");
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  /* Giai đoạn lớn đang mở và bước con tương ứng. */
  const [stage, setStage] = useState<StageId>(1);
  const [step, setStep] = useState(1);

  /** Dữ liệu đang dùng ở các giai đoạn; Giai đoạn 1 luôn đọc và ghi qua API. */
  const [workflow, setWorkflow] = useState<WorkflowState>(emptyWorkflow);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void listProjects()
      .then((result) => {
        if (!cancelled) {
          setProjects(result);
          setProjectsError("");
          setProjectsLoadedFor(user.id);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setProjectsError(
            reason instanceof Error
              ? `Không thể tải dự án từ cơ sở dữ liệu: ${reason.message}`
              : "Không thể tải dự án từ cơ sở dữ liệu.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const resetWorkflow = () => {
    setWorkflow(emptyWorkflow());
    setStage(1);
    setStep(1);
  };

  const handleOpenProject = (project: Project) => {
    setProjects((previous) =>
      previous.some((item) => item.id === project.id)
        ? previous
        : [...previous, project],
    );
    setActiveProject(project);
    resetWorkflow();
  };

  const handleBackHome = () => {
    setActiveProject(null);
    resetWorkflow();
  };

  const handleDeleteProject = (projectId: number) => {
    setProjects((previous) => previous.filter((project) => project.id !== projectId));
  };

  /**
   * Bước tối đa được mở ở mỗi giai đoạn — mở khoá dần theo tiến độ thật:
   *  - GĐ1: tới Bước 5 khi đã khoá yêu cầu; các bước sau mở khi đã có kết quả.
   *  - GĐ2: tới Bước 2 khi đã xác nhận danh sách; các bước sau mở theo dữ liệu.
   *  - GĐ3: mở dần sau mỗi bước đã hoàn thành.
   */
  const maxUnlockedStep = (): number => {
    const total = STAGES[stage].steps.length;
    if (stage === 1) {
      if (workflow.specs.length > 0) return total;
      if (workflow.userStoryId) return 4;
      if (workflow.analysis) return 3;
      if (workflow.requirementId) return 2;
      return 1;
    }
    if (stage === 2) {
      if (workflow.classDiagramUrl) return total;
      if (workflow.umlClasses.length > 0) return 5;
      if (workflow.interactions.length > 0) return 5;
      if (Object.keys(workflow.scenarios).length > 0) return 5;
      // Biểu đồ UC đã lưu mã nguồn cũng đủ để mở Bước 3: kịch bản use case
      // được sinh từ dữ liệu actor/use case, không phụ thuộc ảnh đã render.
      if (workflow.useCaseDiagramCode) return 3;
      if (workflow.actors.length > 0 && workflow.usecases.length > 0) return 3;
      return 1;
    }
    if (workflow.previewImageUrl) return 4;
    if (
      workflow.diagramCode.trim() &&
      workflow.diagramCode !== "@startuml\n@enduml"
    )
      return 3;
    return 2;
  };

  /**
   * Giai đoạn 1 hoàn thành khi mọi yêu cầu đã được xác nhận VÀ đã sinh được
   * ít nhất một đặc tả. Giai đoạn 2 hoàn thành khi đã có mô hình lớp (bước
   * cuối) cùng biểu đồ use case.
   */
  const stage1Complete =
    workflow.requirementLocked &&
    workflow.userStoryId !== null &&
    workflow.specs.length > 0;
  const stage2Complete =
    stage1Complete &&
    workflow.actorsUseCasesConfirmed &&
    workflow.useCaseDiagramConfirmed &&
    workflow.scenariosConfirmed &&
    workflow.interactionsConfirmed &&
    workflow.classDiagramConfirmed &&
    workflow.umlClasses.length > 0 &&
    workflow.classDiagramUrl !== null;

  /** Các giai đoạn đã thực sự hoàn thành, dùng để tô xanh đúng tiến độ. */
  const completedStages = [
    ...(stage1Complete ? [1 as StageId] : []),
    ...(stage2Complete ? [2 as StageId] : []),
  ];

  /**
   * Chỉ mở khoá giai đoạn khi giai đoạn trước đã hoàn thành thật, không mở
   * sẵn cả ba ngay từ đầu.
   */
  const maxUnlockedStage = (): StageId => {
    if (stage2Complete) return 3;
    if (stage1Complete) return 2;
    return 1;
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
        user={user}
        onOpen={handleOpenProject}
        onDelete={handleDeleteProject}
        onLogout={logout}
        loading={projectsLoadedFor !== user.id}
        loadError={projectsError}
      />
    );
  }

  // 2) Workspace: 3 GIAI ĐOẠN lớn, mỗi giai đoạn có sub-stepper riêng.
  return (
    <div className="relative min-h-screen bg-slate-50">
      <div className="fixed inset-0 z-0">
        <StageBackdrop />
      </div>

      <div className="relative z-10">
      <div className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 flex items-center justify-between gap-3 py-3">
          <button
            type="button"
            onClick={handleBackHome}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-violet-600"
          >
            ← Trang chủ
          </button>
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 text-right">
              <span className="block max-w-[16rem] break-words text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">
                {activeProject.name}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2 border-l border-slate-200 pl-3">
              {user.avatar_url && (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="h-8 w-8 rounded-full"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="hidden max-w-35 truncate text-xs text-slate-600 sm:block">
                {user.name || user.email}
              </span>
              <button
                type="button"
                onClick={logout}
                className="inline-flex h-8 items-center whitespace-nowrap rounded-lg px-2 text-xs font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </div>

      <GiaiDoanStepper
        stage={stage}
        maxUnlockedStage={maxUnlockedStage()}
        completedStages={completedStages}
        onStageChange={(next) => {
          setStage(next);
          setStep(1);
        }}
      />

      <Stepper
        stage={stage}
        step={step}
        maxUnlockedStep={maxUnlockedStep()}
        completedSteps={stage === 1
          ? [
              ...(workflow.requirementId ? [1] : []),
              ...(workflow.analysis ? [2] : []),
              ...(workflow.userStoryId ? [3] : []),
              ...(workflow.specs.length > 0 ? [4, 5] : []),
            ]
          : stage === 2
            ? [
                ...(workflow.actors.length > 0 && workflow.usecases.length > 0 ? [1] : []),
                ...(workflow.useCaseDiagramUrl ? [2] : []),
                ...(workflow.usecases.length > 0 &&
                workflow.usecases.every((useCase) => Boolean(workflow.scenarios[useCase.id]))
                  ? [3]
                  : []),
                ...(workflow.usecases.some((useCase) =>
                  workflow.interactions.some(
                    (diagram) => diagram.usecaseId === useCase.id && Boolean(diagram.imageUrl),
                  ),
                )
                  ? [4]
                  : []),
                ...(workflow.classDiagramUrl ? [5] : []),
              ]
          : undefined}
        onStepChange={setStep}
      />

      <ErrorBoundary>
      <main>
        {stage === 1 && (
          <GiaiDoan1
            projectId={activeProject.id}
            state={workflow}
            setState={setWorkflow}
            step={step}
            onStepChange={setStep}
          />
        )}
        {stage === 2 && (
          <GiaiDoan2
            projectId={activeProject.id}
            state={workflow}
            setState={setWorkflow}
            step={step}
            onStepChange={setStep}
            onReturnStage1={() => {
              setStage(1);
              setStep(1);
            }}
          />
        )}
        {stage === 3 && (
          <GiaiDoan3
            projectId={activeProject.id}
            state={workflow}
            setState={setWorkflow}
            step={step}
            onStepChange={setStep}
          />
        )}
      </main>
      </ErrorBoundary>
      </div>
    </div>
  );
}

export default App;