import type { RequirementInput, ValidationResult } from "./types";

/**
 * Kiểm tra tính đầy đủ cấu trúc của yêu cầu bằng logic thuần (không dùng AI).
 * Trả về danh sách thành phần còn thiếu và thông điệp phản hồi tương ứng.
 */
export function validateRequirement(input: RequirementInput): ValidationResult {
  const missingElements: string[] = [];

  if (!input.actor.trim()) missingElements.push("Vai trò (Actor)");
  if (!input.action.trim()) missingElements.push("Hành động (Action)");
  if (!input.targetObject.trim()) missingElements.push("Đối tượng (Object)");
  if (!input.purpose.trim()) missingElements.push("Mục đích (Purpose)");

  const isComplete = missingElements.length === 0;

  const feedback = isComplete
    ? "Yêu cầu đã đầy đủ 4 thành phần cốt lõi, sẵn sàng sinh đặc tả."
    : `Còn thiếu ${missingElements.length} thành phần: ${missingElements.join(", ")}.`;

  return { isComplete, missingElements, feedback };
}

/** Dựng câu yêu cầu chuẩn hóa theo định dạng EARS. */
export function buildEarsSentence(input: RequirementInput): string {
  const { actor, action, targetObject, purpose } = input;
  if (!actor && !action && !targetObject) {
    return "Vui lòng nhập thông tin bên form để xem trước câu yêu cầu chuẩn hóa...";
  }
  return (
    `Với vai trò là ${actor || "[Tác nhân]"}, ` +
    `tôi muốn ${action || "[thực hiện hành động]"} trên ${targetObject || "[Đối tượng]"}` +
    `${purpose ? ` để ${purpose}` : ""}.`
  );
}

/** Sinh nội dung đặc tả chức năng từ dữ liệu yêu cầu (logic thuần). */
export function buildSpecification(input: RequirementInput): string {
  const { actor, action, targetObject, purpose } = input;
  return (
    `Với vai trò là ${actor}, người dùng có thể ${action} đối với ${targetObject}` +
    (purpose ? ` nhằm ${purpose}.` : ".")
  );
}
