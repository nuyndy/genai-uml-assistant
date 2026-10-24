import { useEffect, useState } from "react";
import { attachDiagramToDoc, renderDiagram } from "../../../services/aiService";
import {
  getSpecificationDocument,
  exportSpecificationDocument,
} from "../../../services/requirementService";
import {
  generateClassDiagram,
  listProjectDiagrams,
  updateDiagram,
  listProjectBaselines,
  createProjectBaseline,
  approveProjectBaseline,
  checkProjectUmlConsistency,
} from "../../../services/umlService";
import {
  singleLineClass,
  wrapClass,
} from "../../common/ui/primitives";
import ProgressOverlay from "../../common/ProgressOverlay";
import GiaiDoan1 from "../giai-doan-1/GiaiDoan1";
import Step2ChinhSuaCapNhat from "./steps/Step2ChinhSuaCapNhat";
import Step3KiemTraNhatQuan from "./steps/Step3KiemTraNhatQuan";
import Step4DuyetBaselineXuatTaiLieu from "./steps/Step4DuyetBaselineXuatTaiLieu";

interface Props {
  projectId: number;
  state: any;
  setState: (updater: (prev: any) => any) => void;
  step: number;
  onStepChange: (step: number) => void;
}

let nextRelationId = 200;
let nextClassId = 200;

export default function GiaiDoan3({
  projectId,
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
      <div className={`relative z-10 w-full max-w-none px-4 sm:px-6 lg:px-8 ${step === 3 ? "flex h-full min-h-0 flex-1 flex-col space-y-0 pt-3 pb-2" : "space-y-6 py-6"}`}>
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
          />
        )}
        {step === 3 && (
          <GiaiDoan1
            projectId={projectId}
            projectName={state.projectName ?? state.name ?? ""}
            state={state}
            setState={setState}
            step={5}
            onStepChange={() => undefined}
          />
        )}
        {step === 4 && (
          <Step4DuyetBaselineXuatTaiLieu
            state={state}
            busy={busy}
            onAttachDiagram={handleAttachDiagram}
            onExportFormatChange={(format) => setState((prev: any) => ({ ...prev, exportFormat: format }))}
            baselines={baselines}
            selectedBaselineId={selectedBaselineId}
            setSelectedBaselineId={setSelectedBaselineId}
            consistencyResult={consistencyResult}
            onCreateBaseline={createBaseline}
            onApproveBaseline={approveBaseline}
            onExportSrs={exportApprovedSrs}
            onStepChange={onStepChange}
          />
        )}
      </div>
    </div>
  );
}
