/**
 * Các thao tác của Giai đoạn 2 gọi umlService.ts và backend thật.
 * Những hàm còn lại ở đây thuộc Giai đoạn 3, đang chờ các API tương ứng.
 */
const delay = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));

/** Ảnh SVG giả lập để preview không bị trống khi chưa có backend render thật. */
export function placeholderImage(label: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='560' height='320'>
    <rect width='100%' height='100%' fill='#f8fafc'/>
    <rect x='8' y='8' width='544' height='304' rx='12' fill='none' stroke='#cbd5e1' stroke-dasharray='6 6'/>
    <text x='50%' y='48%' text-anchor='middle' fill='#94a3b8' font-family='sans-serif' font-size='14'>${label}</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

/** GĐ3 Bước 3 — render mã PlantUML thành ảnh để xem trước. */
export async function renderDiagram(code: string): Promise<string> {
  // TODO(BE): thay bằng POST /diagram/render
  await delay(700);
  return placeholderImage(
    `Ảnh render từ mã biểu đồ (${code.split("\n").length} dòng)`,
  );
}

/** GĐ3 Bước 4 — gộp biểu đồ vào tài liệu đặc tả đã tạo ở GĐ1 Bước 5. */
export async function attachDiagramToDoc(
  diagramName: string,
  imageUrl: string,
): Promise<void> {
  // TODO(BE): thay bằng POST /specs/attach-diagram
  await delay(500);
  console.info(
    `[placeholder] Cần backend: POST /specs/attach-diagram với body { name: "${diagramName}", image: "${imageUrl.slice(0, 40)}..." }`,
  );
}
