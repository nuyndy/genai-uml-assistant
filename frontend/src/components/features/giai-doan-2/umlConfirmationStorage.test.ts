import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readUmlConfirmations,
  writeUmlConfirmations,
  type UmlConfirmationState,
} from "./umlConfirmationStorage";

const confirmedState: UmlConfirmationState = {
  actorsUseCasesConfirmed: true,
  useCaseDiagramConfirmed: true,
  scenariosConfirmed: false,
  interactionsConfirmed: true,
  classDiagramConfirmed: false,
};

describe("lưu trạng thái xác nhận UML", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("khôi phục đầy đủ các xác nhận đã lưu cho cùng dự án", () => {
    writeUmlConfirmations(12, confirmedState);

    expect(readUmlConfirmations(12)).toEqual(confirmedState);
  });

  it("không dùng xác nhận của dự án khác", () => {
    writeUmlConfirmations(12, confirmedState);

    expect(readUmlConfirmations(13)).toEqual({});
  });

  it("bỏ qua dữ liệu hỏng và chỉ đọc các cờ boolean đã biết", () => {
    window.localStorage.setItem(
      "genai-uml-confirmations:12",
      JSON.stringify({
        actorsUseCasesConfirmed: true,
        scenariosConfirmed: "yes",
        unknownFlag: true,
      }),
    );

    expect(readUmlConfirmations(12)).toEqual({
      actorsUseCasesConfirmed: true,
    });
  });

  it("không ném lỗi nếu trình duyệt chặn việc đọc hoặc ghi storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    expect(readUmlConfirmations(12)).toEqual({});

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    expect(() => writeUmlConfirmations(12, confirmedState)).not.toThrow();
  });
});
