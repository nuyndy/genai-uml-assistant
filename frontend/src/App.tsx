import { useEffect, useState } from "react";
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

  const currentStep = STAGES[stage].steps.find((item) => item.id === step) ?? STAGES[stage].steps[0];

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
  // Chỉ yêu cầu dữ liệu đã tồn tại; không bắt buộc người dùng xác nhận/khóa thủ công.
  const hasFunctionalSpecification = workflow.specs.some(
    (specification) => specification.type === "functional",
  );
  const hasNonFunctionalSpecification = workflow.specs.some(
    (specification) => specification.type === "non_functional",
  );
  const stage1Complete =
    workflow.userStoryId !== null &&
    hasFunctionalSpecification &&
    hasNonFunctionalSpecification;

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
    workflow.actors.length > 0 &&
    workflow.usecases.length > 0 &&
    Boolean(workflow.useCaseDiagramUrl) &&
    Boolean(workflow.useCaseDiagramCode?.trim()) &&
    allUseCasesHaveScenarios &&
    allUseCasesHaveInteractionDiagrams &&
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
  // Cho phép chuyển tự do giữa 3 giai đoạn; không khóa điều hướng theo dữ liệu.
  const maxUnlockedStage = (): StageId => 3;

  /** Giải thích rõ điều kiện còn thiếu để người dùng không bị khóa mà không biết lý do. */
  const stageLockReason = (): string => {
    if (!stage1Complete) {
      if (!workflow.userStoryId) return "Giai đoạn 2 đang khóa: dự án chưa có User Story.";
      if (workflow.userStoryId === null) return "Giai đoạn 2 đang khóa: dự án chưa có User Story.";
      if (!hasFunctionalSpecification) return "Giai đoạn 2 đang khóa: cần có ít nhất một đặc tả chức năng (FR).";
      if (!hasNonFunctionalSpecification) return "Giai đoạn 2 đang khóa: cần có đặc tả phi chức năng (NFR).";
      return "Giai đoạn 2 đang khóa: dữ liệu Giai đoạn 1 chưa hoàn tất đồng bộ.";
    }
    if (!stage2Complete) {
      if (workflow.actors.length === 0 || workflow.usecases.length === 0)
        return "Giai đoạn 3 đang khóa: cần có Actor và Use Case ở Giai đoạn 2, Bước 1.";
      if (!allUseCasesHaveScenarios)
        return "Giai đoạn 3 đang khóa: cần lưu kịch bản cho mọi Use Case ở Giai đoạn 2, Bước 2.";
      if (!workflow.useCaseDiagramUrl || !workflow.useCaseDiagramCode?.trim())
        return "Giai đoạn 3 đang khóa: cần có biểu đồ Use Case ở Giai đoạn 2, Bước 3.";
      if (workflow.umlClasses.length === 0 || !workflow.classDiagramUrl || !workflow.classDiagramCode?.trim())
        return "Giai đoạn 3 đang khóa: cần có Domain Model và Class Diagram ở Giai đoạn 2, Bước 4.";
      if (!allUseCasesHaveInteractionDiagrams)
        return "Giai đoạn 3 đang khóa: cần có biểu đồ tương tác cho mọi Use Case ở Giai đoạn 2, Bước 5.";
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

  // 2) Workspace: điều hướng giai đoạn bằng menu dọc cố định.
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      <div className="pointer-events-none fixed inset-0 z-0"><StageBackdrop /></div>
      <aside className="fixed inset-y-0 left-0 z-50 flex w-[76px] flex-col items-center border-r border-emerald-100 bg-white/95 py-4 shadow-[8px_0_28px_-24px_rgba(10,51,35,0.45)] backdrop-blur-xl sm:w-[92px] sm:py-5">
        <button type="button" onClick={handleBackHome} aria-label="Về trang chủ GenAI UML Assistant" title="Về trang chủ" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-lg font-black text-white shadow-md transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">U</button>
        <span className="mt-2 hidden text-center text-[9px] font-bold tracking-wide text-slate-500 sm:block">GENAI UML</span>
        <div className="mt-8 flex w-full flex-1 flex-col items-center">
          
          <nav aria-label="Các giai đoạn của quy trình" className="w-full">
            <ol className="relative flex flex-col items-center gap-5">
              <span aria-hidden="true" className="absolute bottom-7 left-1/2 top-7 -z-10 w-px -translate-x-1/2 bg-emerald-100" />
              {([1, 2, 3] as StageId[]).map((id) => {
                const def = STAGES[id];
                const active = id === stage;
                const done = completedStages.includes(id);
                const unlocked = id <= maxUnlockedStage();
                const clickable = !active;
                return (
                  <li key={id} className="w-full">
                    <button type="button" disabled={!clickable} aria-current={active ? "step" : undefined} aria-label={`Giai đoạn ${id}: ${def.short}${done ? ", đã hoàn thành" : unlocked ? "" : ", đang khóa"}`} title={`Giai đoạn ${id}: ${def.short}`} onClick={() => { if (clickable) { setStage(id); setStep(1); setAccountMenuOpen(false); } }} className={`group mx-auto flex w-full flex-col items-center gap-1.5 px-1 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 ${clickable ? "cursor-pointer" : "cursor-default"}`}>
                      <span className={`relative flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-bold transition sm:h-11 sm:w-11 ${active ? "border-emerald-700 bg-emerald-700 text-white shadow-md shadow-emerald-900/20" : done ? "border-emerald-200 bg-emerald-100 text-emerald-800" : unlocked ? "border-slate-200 bg-white text-slate-600 group-hover:border-emerald-300 group-hover:bg-emerald-50" : "border-slate-100 bg-slate-50 text-slate-300"}`}>
                        {done ? "✓" : id}
                        {active && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-lime-400" />}
                      </span>
                      
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
        <div className="relative mt-4 shrink-0">
          {accountMenuOpen && <div className="absolute bottom-0 left-[calc(100%+12px)] z-[60] w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            <div className="border-b border-slate-100 px-3 py-2"><p className="truncate text-sm font-semibold text-slate-900">{user.name || "Tài khoản"}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div>
            <button type="button" onClick={() => { setAccountMenuOpen(false); logout(); }} className="mt-1 flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50">Đăng xuất</button>
          </div>}
          <button type="button" aria-label="Mở menu tài khoản" aria-expanded={accountMenuOpen} title={user.name || user.email} onClick={() => setAccountMenuOpen((open) => !open)} className="flex h-11 w-11 items-center justify-center rounded-full p-0.5 ring-2 ring-emerald-100 transition hover:ring-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full rounded-full object-cover" referrerPolicy="no-referrer" /> : <span className="flex h-full w-full items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-900">{(user.name || user.email).slice(0, 1).toUpperCase()}</span>}
          </button>
        </div>
      </aside>

      <div className="relative z-10 flex h-dvh min-h-0 flex-col overflow-hidden pl-[76px] sm:pl-[92px]">
        <header className="sticky top-0 z-40 shrink-0 border-b border-emerald-100 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0 max-w-[260px]"><p className="text-xs font-medium text-slate-500">Dự án</p><p className="truncate text-sm font-semibold text-slate-800">{activeProject.name}</p></div>
            <div className="flex min-w-0 items-center justify-center gap-2 sm:gap-4">
              <button type="button" disabled={step <= 1} aria-label="Bước trước" title="Bước trước" onClick={() => setStep((current) => Math.max(1, current - 1))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white text-xl font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-35">‹</button>
              <h1 className="min-w-0 truncate text-center text-base font-bold tracking-tight text-emerald-900 sm:text-lg">{currentStep.label}</h1>
              <button type="button" disabled={step >= STAGES[stage].steps.length} aria-label="Bước tiếp" title="Bước tiếp" onClick={() => setStep((current) => Math.min(STAGES[stage].steps.length, current + 1))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white text-xl font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-35">›</button>
            </div>
            <div className="min-w-0 max-w-[260px] justify-self-end">
              <p className="truncate text-right text-xs font-bold text-emerald-800 sm:text-sm">{STAGES[stage].label}</p>
            </div>
          </div>
        </header>
        
        <ErrorBoundary>
          <main className={stage === 1 && (step === 4 || step === 5) ? "flex min-h-0 flex-1 flex-col overflow-hidden pb-0" : "min-h-[calc(100vh-69px)] pb-8"}>
            
            {stage === 1 && <GiaiDoan1 projectId={activeProject.id} projectName={activeProject.name} state={workflow} setState={setWorkflow} step={step} onStepChange={setStep} />}
            {stage === 2 && <GiaiDoan2 projectId={activeProject.id} state={workflow} setState={setWorkflow} step={step} onStepChange={setStep} onReturnStage1={() => { setStage(1); setStep(1); }} />}
            {stage === 3 && <GiaiDoan3 projectId={activeProject.id} state={workflow} setState={setWorkflow} step={step} onStepChange={setStep} />}
          </main>
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default App;