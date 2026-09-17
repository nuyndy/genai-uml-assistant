export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "genai-uml:projects";

/** Đọc danh sách dự án từ localStorage (an toàn khi dữ liệu hỏng). */
export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Project[]) : [];
  } catch {
    return [];
  }
}

/** Ghi danh sách dự án xuống localStorage. */
export function saveProjects(projects: Project[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // Bỏ qua nếu trình duyệt chặn localStorage (chế độ riêng tư...).
  }
}

/**
 * Chuyển id dạng chuỗi của frontend (`p_...`) sang số ổn định để gửi backend.
 * Cùng một chuỗi luôn cho cùng một số (hash 31-bit, luôn dương).
 */
export function toNumericId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Tạo đối tượng dự án mới (chưa lưu). */
export function createProject(name: string, description: string): Project {
  const now = Date.now();
  return {
    id: `p_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    description: description.trim(),
    createdAt: now,
    updatedAt: now,
  };
}
