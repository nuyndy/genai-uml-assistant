import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SpecificationDocument from "../SpecificationDocument";

describe("SpecificationDocument", () => {
  it("renders Markdown structure as a document without showing Markdown markers", () => {
    render(
      <SpecificationDocument
        content={"## Đặc tả chức năng\n\nHệ thống **xử lý đơn hàng**.\n\n- Kiểm tra giỏ hàng\n- Tạo đơn hàng"}
      />,
    );

    expect(screen.getByRole("heading", { name: "Đặc tả chức năng" })).toBeTruthy();
    expect(screen.getByText("xử lý đơn hàng").tagName).toBe("STRONG");
    expect(screen.getByRole("list").children).toHaveLength(2);
    expect(document.body.textContent).not.toContain("##");
    expect(document.body.textContent).not.toContain("**");
  });

  it("renders Markdown tables as formatted document tables", () => {
    render(
      <SpecificationDocument
        content={"| Trường | Mô tả |\n| --- | --- |\n| Vai trò | Khách hàng |"}
      />,
    );

    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Trường" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "Khách hàng" })).toBeTruthy();
  });

  it("renders the four numbered SRS sections as read-only A4 pages with page numbers", () => {
    render(
      <SpecificationDocument
        content={[
          "# Tài liệu SRS",
          "## 1. Giới thiệu",
          "Nội dung phần một.",
          "## 2. Mô tả tổng thể",
          "Nội dung phần hai.",
          "## 3. Chi tiết yêu cầu",
          "Nội dung phần ba.",
          "## 4. Phụ lục",
          "Nội dung phần bốn.",
        ].join("\n\n")}
      />,
    );

    expect(screen.getByRole("article", { name: "Trang 1 trên 4" })).toBeTruthy();
    expect(screen.getByRole("article", { name: "Trang 4 trên 4" })).toBeTruthy();
    expect(screen.getByText("Trang 1 / 4")).toBeTruthy();
    expect(screen.getByText("Trang 4 / 4")).toBeTruthy();
    expect(screen.getByText("Nội dung phần bốn.")).toBeTruthy();
  });
});
