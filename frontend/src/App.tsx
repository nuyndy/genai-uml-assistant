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
      // Chỉ mở bước kế tiếp sau khi người dùng xác nhận bước hiện tại.
      // Có dữ liệu hoặc có ảnh biểu đồ không đồng nghĩa với đã duyệt.
      if (workflow.classDiagramConfirmed && workflow.classDiagramUrl) return total;
      if (workflow.interactionsConfirmed) return 5;
      if (workflow.scenariosConfirmed) return 4;
      if (workflow.useCaseDiagramConfirmed) return 3;
      if (workflow.actorsUseCasesConfirmed) return 2;
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
      <div className="border-b border-emerald-200 bg-white/95 backdrop-blur">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 py-3">
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
      {stageLockReason() && (
        <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-6 lg:px-8">
          {stageLockReason()}
        </div>
      )}

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