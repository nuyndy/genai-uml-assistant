import { useEffect, useState } from "react";
import { renderDiagram } from "../../common/services/aiService";
import {
  generateClassDiagram,
  listProjectDiagrams,
  updateDiagram,
  listProjectBaselines,
  checkProjectUmlConsistency,
  fixProjectUmlConsistency,
} from "../../common/services/umlService";
import ProgressOverlay from "../../common/ProgressOverlay";
import GiaiDoan1 from "../giai-doan-1/GiaiDoan1";
import Step2ChinhSuaCapNhat from "./steps/Step2ChinhSuaCapNhat";
import Step3KiemTraNhatQuan from "./steps/Step3KiemTraNhatQuan";

interface Props {
  projectId: number;
  projectName: string;
  state: any;
  setState: (updater: (prev: any) => any) => void;
  step: number;
  onStepChange: (step: number) => void;
}

export default function GiaiDoan3({
  projectId,
  projectName,
  state,
  setState,
  step,
  onStepChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [aiTaskLabel, setAiTaskLabel] = useState("");
  const [savedDiagramId, setSavedDiagramId] = useState<number | null>(null);
  const [consistencyResult, setConsistencyResult] = useState<any>(null);
  const [stage3Message, setStage3Message] = useState("");


  const loadBaselines = async () => {
    const items = await listProjectBaselines(projectId);
    const approved = items.find((item) => item.status === "approved");
    setState((prev: any) => ({
      ...prev,
      baselineApproved: Boolean(approved),
    }));
  };

  // Bước 3 của Giai đoạn 3 dùng trực tiếp màn hình Bước 5 Giai đoạn 1,
  // vì vậy dữ liệu SRS và trạng thái lưu được quản lý bởi GiaiDoan1.

  const runConsistencyCheck = async () => {
    setBusy(true);
    setAiTaskLabel("Đang kiểm tra nhất quán UML...");
    setStage3Message("");
    try {
      const result = await checkProjectUmlConsistency(projectId, state.diagramCode);
      setConsistencyResult(result);
      setState((prev: any) => ({
        ...prev,
        consistencyChecked: true,
        baselineApproved: false,
      }));
      const codeIssues =
        (result.missing_in_database ?? []).length +
        (result.missing_in_plantuml ?? []).length +
        (result.missing_relations ?? []).length +
        (result.extra_relations ?? []).length;
      const crossStageIssues = (result.cross_stage_issues ?? []).length;
      setStage3Message(
        result.consistent
          ? "Kiểm tra xuyên Giai đoạn 1–3 hoàn tất: không phát hiện sai lệch."
          : codeIssues > 0 && crossStageIssues > 0
            ? `Phát hiện ${codeIssues} sai lệch giữa mã và mô hình lớp, cùng ${crossStageIssues} vấn đề liên kết xuyên Giai đoạn 1–3.`
            : codeIssues > 0
              ? `Phát hiện ${codeIssues} sai lệch giữa mã PlantUML và mô hình lớp đã lưu.`
              : `Mã lớp không có sai lệch trực tiếp, nhưng còn ${crossStageIssues} vấn đề liên kết dữ liệu xuyên Giai đoạn 1–3.`
      );
      await loadBaselines();
      if (step === 2 && result.consistent) {
        setStage3Message("Đã khắc phục hết sai lệch. Đang quay lại Bước 1 để xác nhận kết quả.");
        onStepChange(1);
      }
    } catch (error) {
      console.error("Không thể kiểm tra UML:", error);
      setState((prev: any) => ({ ...prev, consistencyChecked: false, baselineApproved: false }));
      setStage3Message("Kiểm tra thất bại. Vui lòng thử lại.");
    } finally {
      setBusy(false);
      setAiTaskLabel("");
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function loadSavedDiagram() {
      try {
        const diagrams = await listProjectDiagrams(projectId);
        if (cancelled) return;
        const saved = diagrams
          .filter((diagram) => diagram.type === "class")
          .sort((a, b) => b.id - a.id)[0];
        if (saved) {
          setSavedDiagramId(saved.id);
          setState((prev: any) => ({
            ...prev,
            diagramCode: saved.source_code,
            previewImageUrl: saved.image_url ?? prev.previewImageUrl,
          }));
        } else {
          setSavedDiagramId(null);
        }
      } catch (error) {
        console.error("Không tải được biểu đồ đã lưu:", error);
      }
    }
    void loadSavedDiagram();
    return () => { cancelled = true; };
  }, [projectId, setState]);

  const handleFixWithAI = async () => {
    if (!consistencyResult) {
      setStage3Message("Hãy chọn “Kiểm tra lại” trước để AI nhận được danh sách sai lệch cụ thể.");
      return;
    }
    if (consistencyResult.consistent) {
      setStage3Message("Không có sai lệch cần sửa. Mã PlantUML hiện tại đã nhất quán.");
      return;
    }
    const codeIssueCount =
      (consistencyResult.missing_in_database ?? []).length +
      (consistencyResult.missing_in_plantuml ?? []).length +
      (consistencyResult.missing_relations ?? []).length +
      (consistencyResult.extra_relations ?? []).length;
    if (codeIssueCount === 0 && (consistencyResult.cross_stage_issues ?? []).length > 0) {
      setStage3Message(
        "Các vấn đề còn lại nằm ở dữ liệu liên kết giữa Giai đoạn 1–3, không nằm trong mã biểu đồ lớp. Hãy xử lý các mục được liệt kê ở Bước 1 tại giai đoạn tương ứng; AI không thể tạo thay các yêu cầu, đặc tả hoặc Use Case còn thiếu chỉ bằng cách sửa PlantUML.",
      );
      return;
    }
    setBusy(true);
    setAiTaskLabel("AI đang phân tích sai lệch và đề xuất sửa mã PlantUML...");
    setStage3Message("");
    try {
      const result = await fixProjectUmlConsistency(
        projectId,
        state.diagramCode,
        consistencyResult,
      );
      // Backend đã chạy lại bộ kiểm tra nhất quán trên chính mã AI vừa đề xuất.
      // Giữ kết quả này trên giao diện để người dùng thấy rõ còn sai lệch hay không.
      const verification = result.consistency_result
        ?? await checkProjectUmlConsistency(projectId, result.source_code);
      // Render ngay mã AI vừa sửa để người dùng thấy thay đổi ở cả mã và hình,
      // không phải bấm lưu mới biết AI đã tạo ra kết quả gì.
      let previewImageUrl = state.previewImageUrl;
      try {
        previewImageUrl = await renderDiagram(result.source_code);
      } catch (renderError) {
        console.warn("Mã AI đã được cập nhật nhưng chưa render được ảnh:", renderError);
      }
      setState((prev: any) => ({
        ...prev,
        diagramCode: result.source_code,
        previewImageUrl,
        consistencyChecked: false,
        baselineApproved: false,
      }));
      setConsistencyResult(verification);
      setStage3Message(
        verification.consistent
          ? "AI đã sửa mã PlantUML và kiểm tra lại không còn sai lệch trong phạm vi mô hình lớp. Xem lại kết quả rồi chọn “Lưu chỉnh sửa” để lưu vào dự án."
          : "AI đã cập nhật mã PlantUML và render bản xem trước, nhưng kiểm tra lại vẫn còn sai lệch. Xem danh sách bên dưới; có thể cần sửa mô hình dữ liệu hoặc các bước trước, không chỉ sửa mã.",
      );
    } catch (error) {
      console.error("Không thể sửa sai lệch bằng AI:", error);
      setStage3Message(
        error instanceof Error
          ? `AI không sửa được sai lệch: ${error.message}`
          : "AI không sửa được sai lệch. Hãy kiểm tra Ollama/backend và thử lại.",
      );
    } finally {
      setBusy(false);
      setAiTaskLabel("");
    }
  };

  const handleRenderAndSave = async () => {
    setBusy(true);
    setAiTaskLabel("Đang render và lưu biểu đồ...");
    try {
      const url = await renderDiagram(state.diagramCode);
      let diagramId = savedDiagramId;
      if (diagramId === null) {
        const created = await generateClassDiagram(projectId);
        diagramId = created.id;
        setSavedDiagramId(created.id);
      }
      const saved = await updateDiagram(diagramId, state.diagramCode);
      setState((prev: any) => ({
        ...prev,
        diagramCode: saved.source_code,
        previewImageUrl: saved.image_url ?? url,
      }));
    } catch (error) {
      console.error("Không thể render hoặc lưu biểu đồ:", error);
      window.alert("Không thể lưu biểu đồ. Hãy kiểm tra backend và thử lại.");
    } finally {
      setBusy(false);
      setAiTaskLabel("");
    }
  };

  return (
    <div className={`relative w-full min-w-0 ${step === 3 ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden" : ""}`}>
      {aiTaskLabel && <ProgressOverlay label={aiTaskLabel} />}
      <div className={`relative z-10 w-full max-w-none min-w-0 ${step === 3 ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6 lg:px-8" : "space-y-6 px-4 py-6 sm:px-6 lg:px-8"}`}>
        {step === 1 && (
          <Step3KiemTraNhatQuan
            state={state}
            busy={busy}
            onConsistencyCheck={runConsistencyCheck}
            consistencyResult={consistencyResult}
            stage3Message={stage3Message}
          />
        )}
        {step === 2 && (
          <Step2ChinhSuaCapNhat
            state={state}
            setState={setState}
            consistencyResult={consistencyResult}
            stage3Message={stage3Message}
            busy={busy}
            onConsistencyCheck={runConsistencyCheck}
            onSaveDiagram={handleRenderAndSave}
            onFixWithAI={handleFixWithAI}
          />
        )}
        {step === 3 && (
          <GiaiDoan1
            projectId={projectId}
            projectName={projectName}
            state={state}
            setState={setState}
            step={5}
            onStepChange={() => undefined}
          />
        )}
      </div>
    </div>
  );
}
