import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (
      (part.startsWith("*") && part.endsWith("*")) ||
      (part.startsWith("_") && part.endsWith("_"))
    ) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function renderMarkdown(content: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;
  const lines = content.split(/\r?\n/);

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="mb-4 leading-7 text-slate-800">
        {renderInline(paragraph.join(" "))}
      </p>,
    );
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0 || !listType) return;
    const List = listType;
    blocks.push(
      <List
        key={`list-${blocks.length}`}
        className={`mb-4 space-y-1 pl-7 leading-7 text-slate-800 ${
          listType === "ul" ? "list-disc" : "list-decimal"
        }`}
      >
        {listItems.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </List>,
    );
    listItems = [];
    listType = null;
  };

  const flushText = () => {
    flushParagraph();
    flushList();
  };

  const parseTableCells = (line: string) =>
    line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const separator = lines[lineIndex + 1];
    const separatorCells = separator?.includes("|") ? parseTableCells(separator) : [];
    const isTable =
      line.includes("|") &&
      separatorCells.length > 0 &&
      separatorCells.every((cell) => /^:?-{3,}:?$/.test(cell));

    if (isTable) {
      flushText();
      const headers = parseTableCells(line);
      const rows: string[][] = [];
      lineIndex += 1;
      while (lineIndex + 1 < lines.length && lines[lineIndex + 1].includes("|")) {
        lineIndex += 1;
        rows.push(parseTableCells(lines[lineIndex]));
      }
      blocks.push(
        <div key={`table-${blocks.length}`} className="mb-5 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-800">
            <thead>
              <tr>
                {headers.map((header, index) => (
                  <th key={index} className="border border-slate-300 bg-slate-100 px-3 py-2 font-semibold">
                    {renderInline(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {headers.map((_, columnIndex) => (
                    <td key={columnIndex} className="border border-slate-300 px-3 py-2 align-top">
                      {renderInline(row[columnIndex] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    const unorderedItem = line.match(/^\s*[-+*]\s+(.+)$/);
    const orderedItem = line.match(/^\s*\d+[.)]\s+(.+)$/);

    if (!line.trim()) {
      flushText();
    } else if (/^\s{0,3}(---+|___+|\*\*\*+)\s*$/.test(line)) {
      flushText();
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-6 border-slate-200" />);
    } else if (heading) {
      flushText();
      const level = heading[1].length;
      const text = renderInline(heading[2]);
      const className =
        level === 1
          ? "mb-5 text-2xl font-bold text-slate-950"
          : level === 2
            ? "mb-3 mt-6 border-b border-slate-200 pb-2 text-xl font-semibold text-slate-900"
            : "mb-2 mt-5 text-lg font-semibold text-slate-900";
      blocks.push(
        <h2 key={`h-${blocks.length}`} className={className}>
          {text}
        </h2>,
      );
    } else if (unorderedItem || orderedItem) {
      flushParagraph();
      const nextType = unorderedItem ? "ul" : "ol";
      if (listType !== nextType) flushList();
      listType = nextType;
      listItems.push((unorderedItem ?? orderedItem)![1]);
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }

  flushText();
  return blocks;
}

function splitIntoPages(content: string): string[] {
  const pages: string[] = [];
  let current: string[] = [];
  let hasSectionHeading = false;

  for (const line of content.split(/\r?\n/)) {
    const isSectionHeading = /^## \d+\./.test(line);
    if (isSectionHeading && hasSectionHeading) {
      pages.push(current.join("\n"));
      current = [];
    }
    if (isSectionHeading) hasSectionHeading = true;
    current.push(line);
  }
  if (current.length > 0) pages.push(current.join("\n"));
  return pages.length > 0 ? pages : [content];
}

export default function SpecificationDocument({ content }: { content: string }) {
  const pages = splitIntoPages(content);
  return (
    <div
      aria-label="Bản xem trước tài liệu SRS"
      className="max-w-full space-y-6 overflow-x-auto rounded-xl bg-slate-100 p-3 sm:p-6"
    >
      {pages.map((page, index) => (
        <article
          key={index}
          aria-label={`Trang ${index + 1} trên ${pages.length}`}
          className="srs-document-page mx-auto flex min-h-[1123px] w-full max-w-[794px] flex-col bg-white px-8 py-10 shadow-md sm:px-[76px] sm:py-[72px]"
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
        >
          <header className="mb-8 border-b border-slate-300 pb-3 text-center text-xs uppercase tracking-wide text-slate-600">
            Đặc tả yêu cầu phần mềm
          </header>
          <main className="min-w-0 flex-1 text-[15px] text-slate-900">
            {renderMarkdown(page)}
          </main>
          <footer className="mt-8 flex justify-between border-t border-slate-300 pt-3 text-xs text-slate-500">
            <span>GenAI UML Assistant</span>
            <span>Trang {index + 1} / {pages.length}</span>
          </footer>
        </article>
      ))}
    </div>
  );
}
