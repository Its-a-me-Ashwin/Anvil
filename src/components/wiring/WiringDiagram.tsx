import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ReactFlowInstance,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Maximize, LayoutTemplate, Trash2 } from 'lucide-react';
import type { WiringDiagramData } from './wiringTypes';
import { validateWiringData } from './wiringValidation';
import { layoutWiringDiagram, type WiringNodeData } from './wiringLayout';
import WiringModuleNode from './WiringModuleNode';
import WiringEdge from './WiringEdge';
import type { WiringEdgeData } from './WiringEdge';

const DEMO_DATA: WiringDiagramData = {
  modules: [
    { id: 'uno', name: 'Arduino Uno', pins: ['TX1', 'RX1', 'GND', '5V'] },
    { id: 'gps', name: 'GPS Module', pins: ['TX', 'RX', 'GND', 'VCC'] },
  ],
  connections: [
    ['uno', 'TX1', 'gps', 'RX', '#22c55e'],
    ['uno', 'RX1', 'gps', 'TX', '#3b82f6'],
    ['uno', 'GND', 'gps', 'GND', '#6b7280'],
    ['uno', '5V', 'gps', 'VCC', '#ef4444'],
  ],
};

const nodeTypes = { wiringModule: WiringModuleNode };
const edgeTypes = { wiringEdge: WiringEdge };

function activeData(data: WiringDiagramData): WiringDiagramData {
  return data.modules.length ? data : DEMO_DATA;
}

export default function WiringDiagram({ data, onDelete }: { data: WiringDiagramData; onDelete?: () => void }) {
  const resolved = useMemo(() => activeData(data), [data]);
  const validation = useMemo(() => validateWiringData(resolved), [resolved]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WiringNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<WiringEdgeData>>([]);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdgeState] = useState<string | null>(null);
  const setHoveredEdge = useCallback((id: string | null) => setHoveredEdgeState(id), []);

  const runLayout = useCallback(async () => {
    const { nodes: nextNodes, edges: nextEdges } = await layoutWiringDiagram(resolved);
    const modMap = new Map(resolved.modules.map((m) => [m.id, m.name]));
    const labeledEdges: Edge<WiringEdgeData>[] = nextEdges.map((e) => {
      const [srcMod, srcPin] = e.sourceHandle?.split('::') || ['', ''];
      const [tgtMod, tgtPin] = e.targetHandle?.split('::') || ['', ''];
      return {
        ...e,
        data: {
          ...e.data,
          setHoveredEdge,
          tooltip: `${modMap.get(srcMod) || srcMod}.${srcPin} → ${modMap.get(tgtMod) || tgtMod}.${tgtPin}`,
        },
      };
    });
    setNodes(nextNodes);
    setEdges(labeledEdges);
    setTimeout(() => rfInstance?.fitView({ padding: 0.2 }), 0);
  }, [resolved, rfInstance, setNodes, setEdges, setHoveredEdge]);

  useEffect(() => {
    runLayout();
  }, [runLayout]);

  useEffect(() => {
    setEdges((prev) =>
      prev.map((e) => ({
        ...e,
        data: { ...(e.data || {}), hoveredEdge, setHoveredEdge } as WiringEdgeData,
      }))
    );
  }, [hoveredEdge, setEdges, setHoveredEdge]);

  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: {
          ...n.data,
          highlighted:
            hoveredNode === n.id ||
            (!!hoveredEdge && edges.some((e) => e.id === hoveredEdge && (e.source === n.id || e.target === n.id))),
        },
      }))
    );
  }, [hoveredNode, hoveredEdge, edges, setNodes]);

  return (
    <div className="flex flex-col w-full h-full bg-anvil-bg text-anvil-text">
      <div className="h-12 shrink-0 border-b border-anvil-border bg-anvil-panel flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm">Wiring Diagram</span>
          {!validation.valid && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
              {validation.errors.length} error{validation.errors.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => rfInstance?.fitView({ padding: 0.2 })}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-anvil-panelHover border border-anvil-border hover:bg-anvil-border text-xs transition"
          >
            <Maximize className="w-3.5 h-3.5" />
            Fit View
          </button>
          <button
            onClick={runLayout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-anvil-panelHover border border-anvil-border hover:bg-anvil-border text-xs transition"
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            Auto Layout
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-xs transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>
      {validation.errors.length > 0 && (
        <div className="shrink-0 max-h-24 overflow-auto border-b border-anvil-border bg-anvil-panelHover px-4 py-2 space-y-0.5">
          {validation.errors.map((err, i) => (
            <div key={i} className="text-[11px] text-red-400">
              • {err}
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 min-h-0 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange as OnNodesChange<Node>}
          onEdgesChange={onEdgesChange as OnEdgesChange<Edge>}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={setRfInstance}
          onNodeMouseEnter={(_, n) => setHoveredNode(n.id)}
          onNodeMouseLeave={() => setHoveredNode(null)}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1f2433" />
          <Controls className="bg-anvil-panel border border-anvil-border text-anvil-text" />
        </ReactFlow>
      </div>
    </div>
  );
}
