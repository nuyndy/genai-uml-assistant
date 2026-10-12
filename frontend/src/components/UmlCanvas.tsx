
import { useEffect, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  type Node,
  type Edge,
} from "@xyflow/react";
import { parsePlantUml } from "../services/umlService";

interface UmlCanvasProps {
  projectId: number;
  sourceCode: string;
  onSourceChange?: (newSource: string) => void;
}

interface ParsedModel {
  actors?: Array<{ name: string }>;
  use_cases?: Array<{ name: string }>;
  classes?: Array<{
    name: string;
    attributes?: string[];
    methods?: string[];
  }>;
  relations?: Array<{
    from: string;
    to: string;
    label?: string;
    type?: string;
  }>;
}

type PositionCache = Record<string, { x: number; y: number }>;

function stableId(type: string, name: string): string {
  return `${type}-${encodeURIComponent(name)}`;
}

function getPosition(
  id: string,
  index: number,
  column: number,
  cache: PositionCache,
) {
  // Giữ vị trí người dùng đã kéo nếu phần tử đã xuất hiện trước đó.
  if (cache[id]) return cache[id];

  // Bố cục ban đầu ổn định, không sử dụng Math.random().
  return {
    x: 70 + column * 300,
    y: 60 + index * 120,
  };
}

function modelToFlow(
  parsed: ParsedModel,
  positionCache: PositionCache,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const idMap: Record<string, string> = {};

  parsed.actors?.forEach((actor, index) => {
    const id = stableId("actor", actor.name);
    idMap[actor.name] = id;

    nodes.push({
      id,
      type: "default",
      data: { label: actor.name },
      position: getPosition(id, index, 0, positionCache),
    });
  });

  parsed.use_cases?.forEach((useCase, index) => {
    const id = stableId("usecase", useCase.name);
    idMap[useCase.name] = id;

    nodes.push({
      id,
      type: "default",
      data: { label: useCase.name },
      position: getPosition(id, index, 1, positionCache),
    });
  });

  parsed.classes?.forEach((cls, index) => {
    const id = stableId("class", cls.name);
    idMap[cls.name] = id;

    const label = [
      cls.name,
      ...(cls.attributes ?? []),
      ...(cls.methods ?? []),
    ].join("\n");

    nodes.push({
      id,
      type: "default",
      data: { label },
      position: getPosition(id, index, 2, positionCache),
    });
  });

  parsed.relations?.forEach((relation, index) => {
    const source = idMap[relation.from];
    const target = idMap[relation.to];

    if (!source || !target) return;

    edges.push({
      id: `relation-${index}-${source}-${target}`,
      source,
      target,
      label: relation.label || relation.type || "",
      type: "smoothstep",
      animated: false,
    });
  });

  return { nodes, edges };
}

export default function UmlCanvas({
  projectId,
  sourceCode,
}: UmlCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Lưu tọa độ trong suốt vòng đời component.
  const positionCache = useRef<PositionCache>({});

  useEffect(() => {
    let cancelled = false;

    if (!sourceCode.trim()) {
      setNodes([]);
      setEdges([]);
      return;
    }

    parsePlantUml(projectId, sourceCode)
      .then((parsed) => {
        if (cancelled) return;

        const result = modelToFlow(
          parsed as ParsedModel,
          positionCache.current,
        );

        // Cập nhật cache với các vị trí hiện có.
        result.nodes.forEach((node) => {
          positionCache.current[node.id] = node.position;
        });

        setNodes(result.nodes);
        setEdges(result.edges);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Không thể phân tích mã PlantUML:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, sourceCode, setNodes, setEdges]);

  const handleNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      // Ghi nhớ vị trí sau khi kéo để không bị mất khi tải lại model.
      positionCache.current[node.id] = {
        x: node.position.x,
        y: node.position.y,
      };
    },
    [],
  );

  return (
    <ReactFlowProvider>
      <div
        style={{
          width: "100%",
          height: 480,
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          fitView
          minZoom={0.2}
          maxZoom={2}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
