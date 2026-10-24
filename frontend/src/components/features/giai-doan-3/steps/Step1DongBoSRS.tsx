import { useMemo, useState } from "react";
import { Card, SoftButton, Notice } from "../../../common/ui/primitives";

interface Props {
  state: any;
  srsLoaded: boolean;
  srsMarkdown: string;
  srsSynced: boolean;
  busy: boolean;
  onSyncSrs: () => Promise<void>;
  stage3Message: string;
}

function DocumentImage({ src, alt, caption }: { src?: string | null; alt: string; caption: string }) {
  return src ? (
    <figure className="my-3 rounded-lg border border-slate-200 bg-white p-3">
      <img src={src} alt={alt} className="mx-auto max-h-[560px] max-w-full object-contain" />
      <figcaption className="mt-2 text-center text-xs text-slate-500">{caption}</figcaption>
    </figure>
  ) : (
    <div className="my-3 flex min-h-28 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      Chưa có ảnh biểu đồ cho mục này. Hãy sinh và lưu biểu đồ ở Giai đoạn 2.
    </div>
  );
}

function DocumentTable({ headers, rows }: { headers: string[]; rows: Array<Array<unknown>> }) {
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50">
          <tr>{headers.map((header) => <th key={header} className="border-b border-r border-slate-200 px-3 py-2 font-semibold text-slate-700 last:border-r-0">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={index} className="align-top odd:bg-white even:bg-slate-50/60">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="border-b border-r border-slate-200 px-3 py-2 text-slate-700 last:border-r-0 last:border-b-0">{cell == null || cell === "" ? "—" : String(cell)}</td>)}
            </tr>
          )) : <tr><td colSpan={headers.length} className="px-3 py-6 text-center text-slate-500">Chưa có dữ liệu.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function SectionTitle({ children, id }: { children: React.ReactNode; id: string }) {
  return <h2 id={id} className="scroll-mt-6 border-b border-slate-200 pb-2 pt-6 text-xl font-bold text-slate-900">{children}</h2>;
}

export default function Step1DongBoSRS({
  state,
  srsLoaded,
  srsMarkdown,
  srsSynced,
  busy,
  onSyncSrs,
  stage3Message,
}: Props) {
  const [activeUseCase, setActiveUseCase] = useState<number | null>(null);
  const actors = Array.isArray(state?.actors) ? state.actors : [];
  const useCases = Array.isArray(state?.usecases) ? state.usecases : [];
  const relations = Array.isArray(state?.relations) ? state.relations : [];
  const scenarios = state?.scenarios ?? {};
  const interactions = Array.isArray(state?.interactions) ? state.interactions : [];
  const classes = Array.isArray(state?.umlClasses) ? state.umlClasses : [];
  const selectedUseCase = useCases.find((item: any) => item.id === activeUseCase);
  const tocUseCases = useMemo(() => useCases.map((item: any, index: number) => ({ ...item, number: index + 1 })), [useCases]);

  const actorRows = actors.map((actor: any, index: number) => [
    index + 1, actor.name, actor.description, actor.role, actor.mainBusinesses,
  ]);
  const useCaseRows = useCases.map((useCase: any, index: number) => [
    index + 1, useCase.name,
    relations.filter((relation: any) => relation.to === useCase.name).map((relation: any) => relation.from).join(", "),
  ]);
  const currentScenario = selectedUseCase ? scenarios[selectedUseCase.id] : null;
  const selectedInteraction = selectedUseCase
    ? interactions.find((item: any) => item.usecaseId === selectedUseCase.id && item.type === "sequence")
      ?? interactions.find((item: any) => item.usecaseId === selectedUseCase.id)
    : null;

  return (
    <div className="space-y-4 pb-8">
      <Card
        tone="emerald"
        title="Bước 3 · Sinh tài liệu mô hình hóa UML"
        actions={<div className="flex flex-wrap items-center gap-2"><SoftButton disabled={busy} onClick={onSyncSrs}>{busy ? "Đang tải..." : "Đồng bộ SRS"}</SoftButton></div>}
      >
        <p className="text-sm text-slate-600">Tài liệu tổng hợp mô hình chức năng, cấu trúc và hành vi từ dữ liệu UML đã lưu. Bố cục trình bày theo dạng tài liệu, có mục lục điều hướng và ảnh sơ đồ.</p>
        {stage3Message && <div className="mt-3"><Notice tone="info">{stage3Message}</Notice></div>}
        {srsLoaded && <p className="mt-2 text-xs text-slate-500">SRS {srsSynced ? "đã đồng bộ" : "đã tải"} · {srsMarkdown.length.toLocaleString("vi-VN")} ký tự nguồn</p>}
      </Card>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-slate-200 bg-white p-3 xl:sticky xl:top-4">
          <h3 className="mb-3 px-2 text-sm font-bold text-slate-800">Mục lục tài liệu</h3>
          <nav className="space-y-1 text-sm">
            <a className="block rounded-lg px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-blue-700" href="#uml-function">1. Mô hình hóa chức năng</a>
            <a className="block rounded-lg px-5 py-2 text-slate-600 hover:bg-blue-50" href="#uml-actors">1.1 Danh sách tác nhân</a>
            <a className="block rounded-lg px-5 py-2 text-slate-600 hover:bg-blue-50" href="#uml-overview">1.2 Use Case tổng quan</a>
            {tocUseCases.map((item: any) => <button key={item.id} onClick={() => { setActiveUseCase(item.id); document.getElementById(`uml-uc-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className={`block w-full rounded-lg px-5 py-2 text-left ${activeUseCase === item.id ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>1.2.{item.number} {item.name}</button>)}
            <a className="mt-2 block rounded-lg px-3 py-2 text-slate-700 hover:bg-blue-50" href="#uml-structure">2. Mô hình hóa cấu trúc</a>
            <a className="block rounded-lg px-5 py-2 text-slate-600 hover:bg-blue-50" href="#uml-class-diagram">2.1 Biểu đồ lớp</a>
            <a className="block rounded-lg px-5 py-2 text-slate-600 hover:bg-blue-50" href="#uml-class-details">2.2 Mô tả lớp và quan hệ</a>
            <a className="mt-2 block rounded-lg px-3 py-2 text-slate-700 hover:bg-blue-50" href="#uml-behavior">3. Mô hình hóa hành vi</a>
            <a className="block rounded-lg px-5 py-2 text-slate-600 hover:bg-blue-50" href="#uml-sequence">3.1 Biểu đồ tuần tự</a>
          </nav>
        </aside>

        <article className="min-w-0 rounded-xl border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-8">
          <header className="mb-6 border-b-2 border-slate-800 pb-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tài liệu phân tích và thiết kế hệ thống</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Mô hình hóa UML</h1>
            <p className="mt-2 text-sm text-slate-500">Mô hình chức năng · cấu trúc · hành vi</p>
          </header>

          <SectionTitle id="uml-function">1. Mô hình hóa chức năng</SectionTitle>
          <h3 id="uml-actors" className="scroll-mt-6 pt-4 text-base font-bold text-slate-800">1.1 Danh sách tác nhân</h3>
          <DocumentTable headers={["STT", "Tên tác nhân", "Mô tả tác nhân", "Vai trò", "Các nghiệp vụ chính"]} rows={actorRows} />

          <h3 id="uml-overview" className="scroll-mt-6 pt-5 text-base font-bold text-slate-800">1.2 Biểu đồ Use Case tổng quan của hệ thống</h3>
          <DocumentTable headers={["STT", "Tên Use Case", "Tác nhân"]} rows={useCaseRows} />
          <DocumentImage src={state?.useCaseDiagramUrl} alt="Biểu đồ Use Case tổng quan" caption="Hình 1. Biểu đồ Use Case tổng quan của hệ thống" />

          {tocUseCases.map((useCase: any) => {
            const scenario = scenarios[useCase.id];
            const useCaseInteractions = interactions.filter((item: any) => item.usecaseId === useCase.id);
            const sequence = useCaseInteractions.find((item: any) => item.type === "sequence");
            const activity = useCaseInteractions.find((item: any) => item.type === "activity");
            const actorsForUseCase = relations.filter((relation: any) => relation.to === useCase.name).map((relation: any) => relation.from).join(", ");
            const flowRows = (scenario?.mainFlow ?? []).map((event: string, index: number) => [index + 1, event]);
            const exceptionRows = (scenario?.exceptions ?? []).map((event: string, index: number) => [index + 1, event]);
            return (
              <section key={useCase.id} id={`uml-uc-${useCase.id}`} className="scroll-mt-6 border-t border-slate-200 pt-4">
                <h3 className="text-lg font-bold text-slate-900">1.2.{useCase.number} Use Case {useCase.number}: {useCase.name}</h3>
                <h4 className="mt-4 text-sm font-semibold text-slate-800">a. Sơ đồ Use Case</h4>
                <DocumentImage src={state?.useCaseDiagramUrl} alt={`Sơ đồ Use Case ${useCase.name}`} caption={`Hình  ${useCase.number + 1}. Sơ đồ Use Case – ${useCase.name}`} />
                <h4 className="mt-4 text-sm font-semibold text-slate-800">b. Biểu đồ hoạt động</h4>
                <DocumentImage src={activity?.imageUrl} alt={`Biểu đồ hoạt động ${useCase.name}`} caption={`Biểu đồ hoạt động – ${useCase.name}`} />
                <h4 className="mt-4 text-sm font-semibold text-slate-800">c. Kịch bản Use Case</h4>
                <DocumentTable
                  headers={["Trường", "Nội dung"]}
                  rows={[
                    ["Tên Use Case", useCase.name],
                    ["Tác nhân chính", scenario?.actor?.join(", ") || actorsForUseCase],
                    ["Mô tả", scenario?.description?.join(" ") || useCase.description],
                    ["Điều kiện trước", scenario?.preconditions?.join(" ")],
                    ["Đảm bảo tối thiểu", scenario?.minimalGuarantees?.join(" ")],
                    ["Điều kiện sau", scenario?.postconditions?.join(" ")],
                    ["Chuỗi sự kiện chính", flowRows.length ? flowRows.map((row: any) => `${row[0]}. ${row[1]}`).join("\n") : ""],
                    ["Ngoại lệ", exceptionRows.length ? exceptionRows.map((row: any) => `${row[0]}. ${row[1]}`).join("\n") : ""],
                  ]}
                />
              </section>
            );
          })}

          <SectionTitle id="uml-structure">2. Mô hình hóa cấu trúc</SectionTitle>
          <h3 id="uml-class-diagram" className="scroll-mt-6 pt-4 text-base font-bold text-slate-800">2.1 Biểu đồ lớp</h3>
          <DocumentImage src={state?.classDiagramUrl} alt="Biểu đồ lớp hệ thống" caption="Hình. Biểu đồ lớp tổng thể của hệ thống" />
          <h3 id="uml-class-details" className="scroll-mt-6 pt-4 text-base font-bold text-slate-800">2.2 Mô tả các lớp và các mối quan hệ</h3>
          <DocumentTable headers={["STT", "Tên lớp", "Thuộc tính", "Phương thức"]} rows={classes.map((item: any, index: number) => [index + 1, item.name, (item.attributes ?? []).join("\n"), (item.methods ?? []).join("\n")])} />
          <p className="mt-3 text-sm font-semibold text-slate-800">Mối quan hệ giữa các lớp</p>
          <DocumentTable headers={["STT", "Lớp nguồn", "Quan hệ", "Lớp đích"]} rows={(state?.relations ?? []).filter((item: any) => classes.some((cls: any) => cls.name === item.from) && classes.some((cls: any) => cls.name === item.to)).map((item: any, index: number) => [index + 1, item.from, item.type, item.to])} />

          <SectionTitle id="uml-behavior">3. Mô hình hóa hành vi</SectionTitle>
          <h3 id="uml-sequence" className="scroll-mt-6 pt-4 text-base font-bold text-slate-800">3.1 Biểu đồ tuần tự</h3>
          {tocUseCases.map((useCase: any, index: number) => {
            const diagram = interactions.find((item: any) => item.usecaseId === useCase.id && item.type === "sequence");
            return <section key={useCase.id} className="border-t border-slate-200 py-4"><h4 className="text-sm font-semibold text-slate-800">3.1.{index + 1} Use Case {index + 1}: {useCase.name}</h4><DocumentImage src={diagram?.imageUrl} alt={`Biểu đồ tuần tự ${useCase.name}`} caption={`Biểu đồ tuần tự – ${useCase.name}`} /></section>;
          })}
        </article>
      </div>
    </div>
  );
}
