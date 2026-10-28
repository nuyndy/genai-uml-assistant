import { useEffect, useState } from "react";
import { attachDiagramToDoc, renderDiagram } from "../../common/services/aiService";
import {
  getSpecificationDocument,
  exportSpecificationDocument,
} from "../../common/services/requirementService";
import {
  generateClassDiagram,
  listProjectDiagrams,
  updateDiagram,
  listProjectBaselines,
  createProjectBaseline,
  approveProjectBaseline,
  checkProjectUmlConsistency,
  fixProjectUmlConsistency,
} from "../../common/services/umlService";
import {
  singleLineClass,
  wrapClass,
} from "../../common/ui/primitives";
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

let nextRelationId = 200;
let nextClassId = 200;

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
  const [srsMarkdown, setSrsMarkdown] = useState("");
  const [srsLoaded, setSrsLoaded] = useState(false);
  const [consistencyResult, setConsistencyResult] = useState<any>(null);
  const [baselines, setBaselines] = useState<any[]>([]);
  const [selectedBaselineId, setSelectedBaselineId] = useState<number | null>(null);
  const [stage3Message, setStage3Message] = useState("");


  const loadBaselines = async () => {
    const items = await listProjectBaselines(projectId);
    setBaselines(items);
    const approved = items.find((item) => item.status === "approved");
    setState((prev: any) => ({
      ...prev,
      baselineApproved: Boolean(approved),
    }));
  };

  const syncSrs = async () => {
    setBusy(true);
    setAiTaskLabel("Đang tải tài liệu SRS...");
    setStage3Message("");
    try {
      const document = await getSpecificationDocument(projectId);
      setSrsMarkdown(document.raw_markdown ?? "");
      setSrsLoaded(true);
      setState((prev: any) => ({ ...prev, srsMetadata: document.metadata, srsSynced: true }));
      setStage3Message("Đã tải tài liệu SRS từ backend.");
    } catch (error) {
      console.error("Không thể đồng bộ SRS:", error);
      setState((prev: any) => ({ ...prev, srsSynced: false }));
      setStage3Message("Không tải được SRS. Vui lòng kiểm tra backend.");
    } finally {
      setBusy(false);
      setAiTaskLabel("");
    }
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
      setStage3Message(
        result.consistent
          ? "Biểu đồ lớp PlantUML khớp với dữ liệu lớp và quan hệ đã lưu."
          : "Phát hiện sai lệch giữa PlantUML và dữ liệu UML đã lưu."
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

  const createBaseline = async () => {
    if (!consistencyResult?.consistent) {
      setStage3Message("Cần kiểm tra và xử lý sai lệch UML trước khi tạo baseline.");
      return;
    }
    setBusy(true);
    setAiTaskLabel("Đang tạo baseline...");
    setStage3Message("");
    try {
      const baseline = await createProjectBaseline(
        projectId,
        `Baseline ${new Date().toLocaleString("vi-VN")}`,
        [],
      );
      setSelectedBaselineId(baseline.id);
      await loadBaselines();
      setStage3Message(`Đã tạo baseline phiên bản ${baseline.version}. Baseline vẫn ở trạng thái nháp cho đến khi được duyệt.`);
    } catch (error) {
      console.error("Không thể tạo baseline:", error);
      setStage3Message("Không tạo được baseline. Vui lòng kiểm tra backend.");
    } finally {
      setBusy(false);
      setAiTaskLabel("");
    }
  };

  const approveBaseline = async () => {
    if (selectedBaselineId === null) {
      setStage3Message("Hãy chọn baseline cần duyệt.");
      return;
    }
    if (!consistencyResult?.consistent) {
      setStage3Message("Cần kiểm tra UML thành công trước khi duyệt baseline.");
      return;
    }
    setBusy(true);
    setAiTaskLabel("Đang duyệt baseline...");
    setStage3Message("");
    try {
      await approveProjectBaseline(projectId, selectedBaselineId);
      await loadBaselines();
      setStage3Message("Backend đã duyệt baseline thành công.");
    } catch (error) {
      console.error("Không thể duyệt baseline:", error);
      setState((prev: any) => ({ ...prev, baselineApproved: false }));
      setStage3Message("Backend từ chối duyệt baseline. Hãy kiểm tra các sai lệch hoặc vấn đề còn tồn tại.");
    } finally {
      setBusy(false);
      setAiTaskLabel("");
    }
  };

  const exportApprovedSrs = async () => {
    setBusy(true);
    setAiTaskLabel("Đang xuất tài liệu SRS...");
    setStage3Message("");
    try {
      const result = await exportSpecificationDocument(projectId);
      const objectUrl = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = result.filename || "SRS.docx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setStage3Message("Đã yêu cầu xuất SRS từ baseline được backend chấp nhận.");
    } catch (error) {
      console.error("Không thể xuất SRS:", error);
      setStage3Message("Không xuất được SRS. Hãy xác nhận đã có baseline được duyệt.");
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
      setState((prev: any) => ({
        ...prev,
        diagramCode: result.source_code,
        consistencyChecked: false,
        baselineApproved: false,
      }));
      setConsistencyResult(verification);
      setStage3Message(
        verification.consistent
          ? "AI đã đề xuất mã không còn sai lệch theo bộ kiểm tra. Hãy xem lại và chọn “Lưu chỉnh sửa” để lưu mã cùng bản render."
          : "AI đã đề xuất mã nhưng vẫn còn sai lệch. Danh sách đã được cập nhật; hãy sửa tiếp bằng AI hoặc chỉnh mã thủ công rồi lưu và kiểm tra lại.",
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

  const handleAttachDiagram = async () => {
    if (!state.previewImageUrl) return;
    setBusy(true);
    setAiTaskLabel("Đang chèn biểu đồ vào tài liệu...");
    try {
      const name = `Biểu đồ ${new Date().toLocaleString("vi-VN")}`;
      await attachDiagramToDoc(name, state.previewImageUrl);
      setState((prev: any) => ({
        ...prev,
        embeddedDiagrams: [
          ...prev.embeddedDiagrams,
          { name, imageUrl: state.previewImageUrl! },
        ],
      }));
    } catch (error) {
      console.error("Không thể chèn biểu đồ vào tài liệu:", error);
      window.alert("Không thể chèn biểu đồ vào tài liệu. Hãy thử lại.");
    } finally {
      setBusy(false);
      setAiTaskLabel("");
    }
  };

  return (
    <div className={`relative w-full ${step === 3 ? "flex h-full min-h-0 flex-1 flex-col" : ""}`}>
      {aiTaskLabel && <ProgressOverlay label={aiTaskLabel} />}
      <div className={`relative z-10 w-full max-w-none ${step === 3 ? "flex h-full min-h-0 flex-1 flex-col space-y-0 px-0 pt-3 pb-2" : "space-y-6 px-4 py-6 sm:px-6 lg:px-8"}`}>
        {step === 1 && (
          <Step3KiemTraNhatQuan
            state={state}
            busy={busy}
            onRenderAndSave={handleRenderAndSave}
            onConsistencyCheck={runConsistencyCheck}
            consistencyResult={consistencyResult}
            stage3Message={stage3Message}
            onStepChange={onStepChange}
          />
        )}
        {step === 2 && (
          <Step2ChinhSuaCapNhat
            state={state}
            setState={setState}
            consistencyResult={consistencyResult}
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
