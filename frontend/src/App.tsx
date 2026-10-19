import { useEffect, useState } from "react";
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
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

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
  /**
   * Giai đoạn 1 hoàn thành khi mọi yêu cầu đã được xác nhận VÀ đã sinh được
   * ít nhất một đặc tả. Giai đoạn 2 hoàn thành khi đã có mô hình lớp (bước
   * cuối) cùng biểu đồ use case.
   */
  // Backend hiện chưa lưu trạng thái duyệt riêng cho FR/NFR.
  // Vì vậy chỉ xác nhận giai đoạn hoàn tất khi yêu cầu đã khóa và có đủ
  // hai loại đặc tả; không coi cờ approved giả lập trên frontend là bằng chứng duyệt.
  const hasApprovedFunctionalSpecification = workflow.specs.some(
    (specification) =>
      specification.type === "functional" && specification.approved,
  );
  const hasApprovedNonFunctionalSpecification = workflow.specs.some(
    (specification) =>
      specification.type === "non_functional" && specification.approved,
  );
  const stage1Complete =
    workflow.requirementLocked &&
    workflow.userStoryId !== null &&
    hasApprovedFunctionalSpecification &&
    hasApprovedNonFunctionalSpecification;

  const allUseCasesHaveScenarios =
    workflow.usecases.length > 0 &&
    workflow.usecases.every((useCase) => {
      const scenario = workflow.scenarios[useCase.id];
      return Boolean(
        scenario &&
          (scenario.mainFlow.length > 0 ||
            scenario.altFlows.length > 0 ||
            scenario.exceptions.length > 0),
      );
    });

  const allUseCasesHaveInteractionDiagrams =
    workflow.usecases.length > 0 &&
    workflow.usecases.every((useCase) =>
      workflow.interactions.some(
        (diagram) =>
          diagram.usecaseId === useCase.id &&
          Boolean(diagram.imageUrl) &&
          Boolean(diagram.sourceCode?.trim()),
      ),
    );

  const stage2Complete =
    stage1Complete &&
    workflow.actorsUseCasesConfirmed &&
    workflow.actors.length > 0 &&
    workflow.usecases.length > 0 &&
    workflow.useCaseDiagramConfirmed &&
    Boolean(workflow.useCaseDiagramUrl) &&
    Boolean(workflow.useCaseDiagramCode?.trim()) &&
    workflow.scenariosConfirmed &&
    allUseCasesHaveScenarios &&
    workflow.interactionsConfirmed &&
    allUseCasesHaveInteractionDiagrams &&
    workflow.classDiagramConfirmed &&
    workflow.umlClasses.length > 0 &&
    Boolean(workflow.classDiagramUrl) &&
    Boolean(workflow.classDiagramCode?.trim());

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

  /** Giải thích rõ điều kiện còn thiếu để người dùng không bị khóa mà không biết lý do. */
  const stageLockReason = (): string => {
    if (!stage1Complete) {
      if (!workflow.requirementLocked) return "Giai đoạn 2 đang khóa: hãy xác nhận yêu cầu ở Giai đoạn 1.";
      if (workflow.userStoryId === null) return "Giai đoạn 2 đang khóa: dự án chưa có User Story.";
      if (!hasApprovedFunctionalSpecification) return "Giai đoạn 2 đang khóa: cần duyệt ít nhất một đặc tả chức năng (FR).";
      if (!hasApprovedNonFunctionalSpecification) return "Giai đoạn 2 đang khóa: cần duyệt đặc tả phi chức năng (NFR).";
      return "Giai đoạn 2 đang khóa: dữ liệu Giai đoạn 1 chưa hoàn tất đồng bộ.";
    }
    if (!stage2Complete) {
      if (!workflow.actorsUseCasesConfirmed || workflow.actors.length === 0 || workflow.usecases.length === 0)
        return "Giai đoạn 3 đang khóa: hãy xác nhận Actor và Use Case ở Giai đoạn 2, Bước 1.";
      if (!workflow.useCaseDiagramConfirmed || !workflow.useCaseDiagramUrl || !workflow.useCaseDiagramCode?.trim())
        return "Giai đoạn 3 đang khóa: hãy tạo và xác nhận biểu đồ Use Case ở Bước 2.";
      if (!workflow.scenariosConfirmed || !allUseCasesHaveScenarios)
        return "Giai đoạn 3 đang khóa: cần hoàn thiện và xác nhận kịch bản cho mọi Use Case ở Bước 3.";
      if (!workflow.interactionsConfirmed || !allUseCasesHaveInteractionDiagrams)
        return "Giai đoạn 3 đang khóa: cần tạo và xác nhận biểu đồ tương tác cho mọi Use Case ở Bước 4.";
      if (!workflow.classDiagramConfirmed || workflow.umlClasses.length === 0 || !workflow.classDiagramUrl || !workflow.classDiagramCode?.trim())
        return "Giai đoạn 3 đang khóa: cần tạo và xác nhận biểu đồ lớp ở Bước 5.";
      return "Giai đoạn 3 đang khóa: dữ liệu UML chưa hoàn tất đồng bộ.";
    }
    return "";
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
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50">
      <div className="fixed inset-0 z-0">
        <StageBackdrop />
      </div>

      <div className="relative z-10">
      <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex min-h-[68px] w-full max-w-[1600px] items-center gap-3 px-3 py-2 sm:gap-5 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={handleBackHome}
            aria-label="Về trang chủ GenAI UML Assistant"
            className="flex min-w-0 shrink-0 items-center gap-2 rounded-xl text-left transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:gap-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-900 text-sm font-bold text-white shadow-sm">U</span>
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-[12rem] truncate text-sm font-bold tracking-tight text-slate-900">GenAI UML Assistant</span>
              <span className="block max-w-[12rem] truncate text-[11px] text-slate-500">{activeProject.name}</span>
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <GiaiDoanStepper
              stage={stage}
              maxUnlockedStage={maxUnlockedStage()}
              completedStages={completedStages}
              onStageChange={(next) => {
                setStage(next);
                setStep(1);
              }}
            />
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              aria-label="Mở menu tài khoản"
              aria-expanded={accountMenuOpen}
              onClick={() => setAccountMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-full p-1.5 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full border border-slate-200 object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-900">
                  {(user.name || user.email).slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="hidden max-w-36 truncate text-xs font-medium text-slate-700 lg:block">{user.name || user.email}</span>
              <span aria-hidden="true" className="hidden text-xs text-slate-500 sm:block">⌄</span>
            </button>
            {accountMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="border-b border-slate-100 px-3 py-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{user.name || "Tài khoản"}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setAccountMenuOpen(false); logout(); }}
                  className="mt-1 flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {stageLockReason() && (
        <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 sm:px-6 lg:px-8">
          {stageLockReason()}
        </div>
      )}

      <ErrorBoundary>
      <main className="pb-24 sm:pb-20">
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

      <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-emerald-100 bg-white/95 shadow-[0_-8px_24px_-20px_rgba(10,51,35,0.5)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-1.5 px-2 py-2 sm:gap-3 sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Bước trước"
            title="Bước trước"
            disabled={step <= 1}
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 sm:px-4"
          >
            ← <span className="hidden xl:inline">Bước trước</span>
          </button>
          <nav aria-label="Điều hướng bước" className="min-w-0 flex-1 overflow-x-auto">
            <ol className="flex w-max min-w-full items-center justify-start gap-1 py-0.5 sm:justify-center sm:gap-2">
              {STAGES[stage].steps.map((item) => (
                <li key={item.id} className="shrink-0">
                  <button
                    type="button"
                    aria-current={step === item.id ? "step" : undefined}
                    title={item.label}
                    onClick={() => setStep(item.id)}
                    className={`flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition sm:px-3 sm:text-sm lg:px-4 ${
                      step === item.id
                        ? "bg-emerald-800 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
                    }`}
                  >
                    <span className="tabular-nums">{item.id}</span>
                    <span className="hidden lg:inline">{item.label}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <button
            type="button"
            aria-label="Bước tiếp"
            title="Bước tiếp"
            disabled={step >= STAGES[stage].steps.length}
            onClick={() => setStep((current) => Math.min(STAGES[stage].steps.length, current + 1))}
            className="shrink-0 rounded-xl bg-emerald-800 px-2.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-35 sm:px-4"
          >
            <span className="hidden xl:inline">Bước tiếp</span> →
          </button>
        </div>
      </footer>
      </div>
    </div>
  );
}

export default App;