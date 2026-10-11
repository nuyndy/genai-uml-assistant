import React, { useEffect, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ReactFlowProvider,
} from "@xyflow/react";
import { parsePlantUml } from "../services/umlService";

/**
 * Minimal UML canvas that displays actors, use‑cases and classes parsed from PlantUML.
 * It is tolerant – nodes/edges that cannot be parsed are ignored.
 *
 * Props:
 *   projectId – id of current project (used for API call).
 *   sourceCode – PlantUML source string.
 *   onSourceChange – callback when user drags a node; receives updated PlantUML source.
 */
interface UmlCanvasProps {
  projectId: number;
  sourceCode: string;
  onSourceChange?: (newSource: string) => void;
}

// Helper to convert parsed model to xyflow nodes/edges
function modelToFlow(parsed: any): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const idMap: Record<string, string> = {};
  // Actors
  parsed.actors?.forEach((actor: any, idx: number) => {
    const id = `actor-${idx}`;
    idMap[actor.name] = id;
    nodes.push({
      id,
      type: "default",
      data: { label: actor.name },
      position: { x: Math.random() * 400, y: Math.random() * 200 },
    });
  });
  // Use cases
  parsed.use_cases?.forEach((uc: any, idx: number) => {
    const id = `usecase-${idx}`;
    idMap[uc.name] = id;
    nodes.push({
      id,
      type: "default",
      data: { label: uc.name },
      position: { x: Math.random() * 400 + 200, y: Math.random() * 200 },
    });
  });
  // Classes
  parsed.classes?.forEach((cls: any, idx: number) => {
    const id = `class-${idx}`;
    idMap[cls.name] = id;
    const label = `${cls.name}\\n${cls.attributes?.join("\\n") || ""}\\n${cls.methods?.join("\\n") || ""}`;
    nodes.push({
      id,
      type: "default",
      data: { label },
      position: { x: Math.random() * 400 + 400, y: Math.random() * 200 },
    });
  });
  // Relations → edges
  parsed.relations?.forEach((rel: any, idx: number) => {
    const source = idMap[rel.from];
    const target = idMap[rel.to];
    if (source && target) {
      edges.push({
        id: `e-${idx}`,
        source,
        target,
        label: rel.label || rel.type,
        animated: false,
        type: "smoothstep",
      });
    }
  });
  return { nodes, edges };
}

export default function UmlCanvas({ projectId, sourceCode, onSourceChange }: UmlCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Load model when sourceCode changes
  useEffect(() => {
    let cancelled = false;
    parsePlantUml(projectId, sourceCode)
      .then((parsed) => {
        if (cancelled) return;
        const { nodes: n, edges: e } = modelToFlow(parsed);
        setNodes(n);
        setEdges(e);
      })
      .catch((err) => {
        console.error("Failed to parse PlantUML", err);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, sourceCode, setNodes, setEdges]);

  // When nodes are moved, we could regenerate PlantUML source (TODO).
  // For now we just expose the callback with the original source.
  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      if (onSourceChange) {
        // Future: generate new source from updated node positions.
        onSourceChange(sourceCode);
      }
    },
    [onSourceChange, sourceCode]
  );

  return (
    <ReactFlowProvider>
      <div style={{ width: "100%", height: "400px" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
