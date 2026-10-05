import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../HomePage";
import { deleteProject } from "../projectStore";

vi.mock("../projectStore", () => ({
  createProject: vi.fn(),
  deleteProject: vi.fn(),
}));

const user = {
  id: 3,
  name: "Test User",
  email: "test@example.com",
  avatar_url: null,
};

const project = {
  id: 42,
  name: "Library Management Project",
  created_at: null,
};

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps project ID separate from open and delete actions", () => {
    render(
      <HomePage
        projects={[project]}
        user={user}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onLogout={vi.fn()}
        loading={false}
        loadError=""
      />,
    );

    expect(screen.getByText("ID 42")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mở dự án/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xóa dự án" })).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đăng xuất" })).toBeInTheDocument();
  });

  it("asks before deleting, then removes the project after API success", async () => {
    const onDelete = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(deleteProject).mockResolvedValueOnce();

    render(
      <HomePage
        projects={[project]}
        user={user}
        onOpen={vi.fn()}
        onDelete={onDelete}
        onLogout={vi.fn()}
        loading={false}
        loadError=""
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Xóa dự án" }));

    await waitFor(() => {
      expect(deleteProject).toHaveBeenCalledWith(project.id);
      expect(onDelete).toHaveBeenCalledWith(project.id);
    });
  });

  it("displays project loading errors", () => {
    render(
      <HomePage
        projects={[]}
        user={user}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onLogout={vi.fn()}
        loading={false}
        loadError="Không thể tải dự án."
      />,
    );
    expect(screen.getByText("Không thể tải dự án.")).toBeInTheDocument();
  });
});
