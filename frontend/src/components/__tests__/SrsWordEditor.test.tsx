import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SrsWordEditor from "../SrsWordEditor";
import { emptyFunctionalSpecification, emptyNonFunctionalSpecification } from "../SpecificationEditor";
import type {
  FunctionalSpecification,
  NonFunctionalSpecification,
  SrsMetadata,
  SpecificationRecord,
} from "../common/services/requirementService";

const metadata: SrsMetadata = {
  intro_purpose: "Mục đích",
  intro_scope: "Phạm vi",
  intro_definitions: "Thuật ngữ",
  overview_user_classes: "Lớp người dùng",
  overview_environment: "Môi trường",
  appendix_notes: "Ghi chú phụ lục",
};

const functionalRecord: SpecificationRecord = {
  id: 1,
  user_story_id: 7,
  feature: "Đặt hàng",
  type: "functional",
  content: "{}",
  version: 1,
  approval_status: "draft",
};

const nonFunctionalRecord: SpecificationRecord = {
  id: 2,
  user_story_id: null,
  feature: "Đặc tả phi chức năng",
  type: "non_functional",
  content: "{}",
  version: 1,
  approval_status: "draft",
};

const functionalValue: FunctionalSpecification = {
  ...emptyFunctionalSpecification(),
  function_code: "UC01",
  function_name: "Đặt hàng",
  description: "Khách hàng đặt hàng.",
  actors: ["Khách hàng"],
  field_mapping: [
    { field_name: "so_don", data_type: "String", required: true, validation_rule: "Không rỗng" },
  ],
};

const nonFunctionalValue: NonFunctionalSpecification = emptyNonFunctionalSpecification();

function renderEditor() {
  const onChangeMetadata = vi.fn();
  const onChangeSpecification = vi.fn();
  render(
    <SrsWordEditor
      projectName="Dự án kiểm thử"
      metadata={metadata}
      functional={[{ ...functionalRecord, value: functionalValue } as never]}
      nonFunctional={[{ ...nonFunctionalRecord, value: nonFunctionalValue } as never]}
      onChangeMetadata={onChangeMetadata}
      onChangeSpecification={onChangeSpecification}
    />,
  );
  return {
    onChangeMetadata,
    onChangeSpecification: onChangeSpecification as Mock<
      (
        record: SpecificationRecord,
        content: FunctionalSpecification | NonFunctionalSpecification,
      ) => void
    >,
  };
}

describe("SrsWordEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hiển thị đủ 4 phần SRS chuẩn theo đúng số mục", () => {
    renderEditor();
    expect(screen.getByRole("heading", { name: "1. Giới thiệu" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "2. Mô tả tổng thể" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "3. Chi tiết yêu cầu" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "3.1 Đặc tả chức năng" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "3.2 Đặc tả phi chức năng" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "4. Phụ lục" })).toBeTruthy();
  });

  it("sửa được phần giới thiệu trực tiếp trên trang tài liệu", () => {
    const { onChangeMetadata } = renderEditor();
    fireEvent.change(screen.getByLabelText("1.1 Mục đích"), {
      target: { value: "Mục đích đã sửa" },
    });
    expect(onChangeMetadata).toHaveBeenCalledWith({
      ...metadata,
      intro_purpose: "Mục đích đã sửa",
    });
  });

  it("sửa được nội dung đặc tả chức năng và báo ra đúng bản ghi", () => {
    const { onChangeSpecification } = renderEditor();
    fireEvent.change(screen.getByLabelText("Mô tả"), {
      target: { value: "Mô tả đã sửa" },
    });
    expect(onChangeSpecification).toHaveBeenCalledTimes(1);
    const [record, content] = onChangeSpecification.mock.calls[0] as [
      SpecificationRecord,
      FunctionalSpecification,
    ];
    expect(record.id).toBe(1);
    expect(content.description).toBe("Mô tả đã sửa");
    expect(content.function_code).toBe("UC01");
  });

  it("sửa được tiêu chí của nhóm phi chức năng", () => {
    const { onChangeSpecification } = renderEditor();
    const group = nonFunctionalValue.items[0].group;
    fireEvent.change(screen.getByLabelText(`Tiêu chí ${group}`), {
      target: { value: "Tiêu chí đã sửa" },
    });
    const [record, content] = onChangeSpecification.mock.calls[0] as [
      SpecificationRecord,
      NonFunctionalSpecification,
    ];
    expect(record.type).toBe("non_functional");
    expect(content.items[0].criteria).toBe("Tiêu chí đã sửa");
  });

  it("hiển thị bảng ánh xạ trường dữ liệu với ô nhập cho từng cột", () => {
    renderEditor();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByLabelText("Tên trường dòng 1")).toBeTruthy();
    expect(screen.getByLabelText("Kiểu dữ liệu dòng 1")).toBeTruthy();
    expect(screen.getByLabelText("Bắt buộc dòng 1")).toBeTruthy();
    expect(screen.getByLabelText("Quy tắc kiểm tra dòng 1")).toBeTruthy();
  });

  it("không dùng dấu gạch ngang dài trong văn bản hiển thị", () => {
    renderEditor();
    expect(document.body.textContent).not.toContain("—");
  });
});
