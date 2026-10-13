// Preview tạm thời để kiểm tra bố cục: dựng workspace 3 giai đoạn ngoài auth.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import GiaiDoanStepper from "./components/common/GiaiDoanStepper";
import Stepper from "./components/common/Stepper";
import GiaiDoan1 from "./components/features/giai-doan-1/GiaiDoan1";
import GiaiDoan2 from "./components/features/giai-doan-2/GiaiDoan2";
import GiaiDoan3 from "./components/features/giai-doan-3/GiaiDoan3";
import { emptyWorkflow, type WorkflowState } from "./types/workflow";
import type { StageId } from "./stages";
import "./index.css";

export function Demo() {
  const p = new URLSearchParams(location.search);
  const stage = Math.min(3, Math.max(1, Number(p.get("s")) || 1)) as StageId;
  const step = Math.min(5, Math.max(1, Number(p.get("b")) || 1));
  const parsedProjectId = Number(p.get("projectId"));
  const projectId = Number.isInteger(parsedProjectId) && parsedProjectId > 0
    ? parsedProjectId
    : undefined;
  const [wf, setWf] = useState<WorkflowState>(() => {
    const s = emptyWorkflow();
    if (stage === 1) return s;
    // Dữ liệu mẫu để kiểm tra chữ dài, có dữ liệu và trạng thái rỗng.
    s.rawRequirement = {
      actor: "Giảng viên và cộng tác viên của khoa",
      action: "truy vấn và đối chiếu kết quả đào tạo theo học kỳ",
      targetObject: "hồ sơ sinh viên",
      purpose: "tự động hoá việc lập báo cáo định kỳ",
      preConditions: [],
      businessRules: [],
    };
    s.analysis = {
      complete: ["Vai trò (Actor)", "Hành động (Action)", "Đối tượng (Object)"],
      missing: [
        { element: "Mục đích (Purpose)", suggestion: "Nêu rõ lợi ích cụ thể mang lại cho người dùng và tổ chức." },
      ],
    };
    s.specs = [
      { id: 1, feature: "Báo cáo đào tạo theo học kỳ", type: "functional", content: "## Đặc tả chức năng\nHệ thống cho phép giảng viên truy vấn kết quả đào tạo.\n\n- Tổng hợp theo khoa và học kỳ.\n- Xuất báo cáo.", approved: true },
      { id: 2, feature: "Hiệu năng truy vấn", type: "non_functional", content: "Phản hồi dưới 2 giây với 100 nghìn bản ghi.", approved: true },
    ];
    s.actors = [{ id: 1, name: "Giảng viên" }, { id: 2, name: "Trưởng khoa" }];
    s.usecases = [
      { id: 1, name: "Lập báo cáo đào tạo theo học kỳ", description: "Tổng hợp số liệu và xuất file." },
      { id: 2, name: "Đối chiếu kết quả với lớp học phần", description: "" },
    ];
    s.scenarios = {
      1: {
        mainFlow: ["1. Chọn kỳ", "2. Chọn khoa", "3. Xem báo cáo", "4. Xuất file"],
        altFlows: ["1a. Bỏ chọn kỳ để chọn lại."],
        exceptions: ["3a. Dữ liệu chưa đồng bộ."],
      },
    };
    s.umlClasses = [
      { id: 1, name: "ReportController", attributes: ["id: int", "createdAt: datetime"], methods: ["create()", "export()"] },
      { id: 2, name: "StudentRecord", attributes: ["code: string"], methods: ["find()"] },
    ];
    s.relations = [{ id: 1, from: "Giảng viên", to: "Lập báo cáo đào tạo theo học kỳ", type: "association" }];
    s.diagramCode = "@startuml\nactor \"Giảng viên\" as GV\n@enduml";
    return s;
  });

  const renderPanel = () => {
    if (stage === 1) {
      return (
        <GiaiDoan1
          projectId={projectId}
          state={wf}
          setState={setWf}
          step={step}
          onStepChange={() => {}}
        />
      );
    }
    if (stage === 2) {
      return <GiaiDoan2 state={wf} setState={setWf} step={step} onStepChange={() => {}} />;
    }
    return <GiaiDoan3 state={wf} setState={setWf} step={step} onStepChange={() => {}} />;
  };
  return (
    <div className="relative min-h-screen bg-slate-50">
      <div className="fixed inset-0 z-0">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-50/70 via-slate-50 to-slate-50" />
          <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-violet-200/25 blur-3xl" />
          <div className="absolute -bottom-32 right-0 h-72 w-72 rounded-full bg-emerald-100/25 blur-3xl" />
        </div>
      </div>
      <div className="relative z-10">
        <GiaiDoanStepper stage={stage} maxUnlockedStage={3} />
        <Stepper stage={stage} step={step} maxUnlockedStep={5} />
        <main>
          {renderPanel()}
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Demo />);
