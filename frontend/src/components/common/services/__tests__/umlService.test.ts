import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setToken } from "../authService";
import {
  extractProjectActorsUseCasesBatch,
  generateProjectInteractionDiagramsBatch,
  generateProjectScenariosBatch,
  generateInteractionDiagram,
  getProjectUmlState,
  listSpecificationsForUml,
  saveProjectActorUseCasesBatch,
} from "../umlService";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  localStorage.clear();
  setToken("uml-test-token");
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("umlService", () => {
  it("loads saved UML state from the project database endpoint", async () => {
    const saved = {
      actors: [{ id: 4, project_id: 9, name: "Khách hàng" }],
      use_cases: [],
      relations: [],
      diagrams: [],
      classes: [],
      class_relations: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(saved));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getProjectUmlState(9)).resolves.toEqual(saved);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/projects/9/uml-state",
      expect.any(Object),
    );
  });

  it("requests only specifications available for UML extraction", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await listSpecificationsForUml(9);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/projects/9/specifications-with-stories",
      expect.any(Object),
    );
  });

  it("sends the selected interaction diagram type to the real API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 3,
        project_id: 9,
        use_case_id: 6,
        type: "sequence",
        source_code: "@startuml\n@enduml",
        image_url: "https://renderer.example/sequence.svg",
        version: 1,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await generateInteractionDiagram(6, "sequence");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/use-cases/6/diagrams",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ diagram_type: "sequence" }),
      }),
    );
  });

  it("uses batch APIs for extraction, saving, scenarios, and interaction diagrams", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await extractProjectActorsUseCasesBatch(9);
    await saveProjectActorUseCasesBatch(9, {
      actors: [{ name: "Khách hàng" }],
      use_cases: [{ specification_id: 3, name: "Đặt hàng" }],
      relations: [],
    });
    await generateProjectScenariosBatch(9);
    await generateProjectInteractionDiagramsBatch(9, "collaboration");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:8000/api/projects/9/extract-actors-usecases-batch",
      "http://localhost:8000/api/projects/9/actors-use-cases/batch",
      "http://localhost:8000/api/projects/9/use-cases/generate-scenarios-batch",
      "http://localhost:8000/api/projects/9/use-cases/generate-interaction-diagrams-batch",
    ]);
    expect(JSON.parse(fetchMock.mock.calls[3][1].body as string)).toEqual({
      diagram_type: "collaboration",
    });
  });
});
