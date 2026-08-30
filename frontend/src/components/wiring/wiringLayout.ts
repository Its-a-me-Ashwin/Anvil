import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from '@xyflow/react';
import type { WiringDiagramData, WiringModule, WiringConnection } from './wiringTypes';

const elk = new ELK();

export interface WiringNodeData extends Record<string, unknown> {
  module: WiringModule;
  width: number;
  height: number;
  sides: Record<string, 'left' | 'right'>;
  ports: Record<string, { x: number; y: number }>;
  highlighted: boolean;
}

type ElkSide = 'WEST' | 'EAST';

const PIN_SPACING = 24;
const PAD_V = 36;
const PAD_H = 44;

function pinSide(m: WiringModule, pin: string, connections: WiringConnection[]): ElkSide {
  return connections.some((c) => c[2] === m.id && c[3] === pin) ? 'WEST' : 'EAST';
}

function pinOrder(m: WiringModule, connections: WiringConnection[]) {
  const meta = m.pins.map((pin) => {
    const side = pinSide(m, pin, connections);
    const neighbors = new Set<string>();
    for (const c of connections) {
      if (c[0] === m.id && c[1] === pin) neighbors.add(c[2]);
      else if (c[2] === m.id && c[3] === pin) neighbors.add(c[0]);
    }
    return { pin, side, group: [...neighbors].sort().join(',') || '_' };
  });
  const left = meta
    .filter((x) => x.side === 'WEST')
    .sort((a, b) => (a.group === b.group ? a.pin.localeCompare(b.pin) : a.group.localeCompare(b.group)));
  const right = meta
    .filter((x) => x.side === 'EAST')
    .sort((a, b) => (a.group === b.group ? a.pin.localeCompare(b.pin) : a.group.localeCompare(b.group)));
  const order: Record<string, number> = {};
  left.forEach((x, i) => (order[x.pin] = i));
  right.forEach((x, i) => (order[x.pin] = i));
  return { order, leftCount: left.length, rightCount: right.length };
}

function nodeDimensions(m: WiringModule, connections: WiringConnection[]) {
  const { leftCount, rightCount } = pinOrder(m, connections);
  const maxPins = Math.max(leftCount, rightCount, 1);
  const maxLabelLen = Math.max(m.name.length, ...m.pins.map((p) => p.length));
  return {
    width: Math.max(140, maxLabelLen * 8 + PAD_H),
    height: Math.max(90, maxPins * PIN_SPACING + PAD_V),
  };
}

export async function layoutWiringDiagram(rawData: WiringDiagramData): Promise<{ nodes: Node<WiringNodeData>[]; edges: Edge[] }> {
  // Malformed diagrams (e.g. an agent-created module missing `pins`) used to
  // crash this whole layout pass with "is not iterable" and take the app
  // down with no way to recover — normalize once here so every module has a
  // real array before anything below touches `.pins`.
  const data: WiringDiagramData = { ...rawData, modules: rawData.modules.map((m) => ({ ...m, pins: m.pins || [] })) };
  const modMap = new Map(data.modules.map((m) => [m.id, m]));

  const children = data.modules.map((m) => {
    const { width, height } = nodeDimensions(m, data.connections);
    const { order } = pinOrder(m, data.connections);
    const ports = m.pins.map((p) => {
      const side = pinSide(m, p, data.connections);
      return {
        id: `${m.id}::${p}`,
        width: 8,
        height: 8,
        x: side === 'WEST' ? 0 : width,
        y: 18 + (order[p] ?? 0) * PIN_SPACING,
        properties: { 'port.side': side },
      };
    });
    return { id: m.id, width, height, ports };
  });

  const elkEdges = data.connections.map(([src, srcPin, tgt, tgtPin]) => ({
    id: `${src}::${srcPin}->${tgt}::${tgtPin}`,
    sources: [`${src}::${srcPin}`],
    targets: [`${tgt}::${tgtPin}`],
  }));

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.layerDistribution': 'NODE_SIZE',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.portConstraints': 'FIXED_SIDE',
    },
    children,
    edges: elkEdges,
  };

  const layout = await elk.layout(graph);

  const nodes: Node<WiringNodeData>[] = (layout.children || []).map((child) => {
    const m = modMap.get(child.id)!;
    const { width, height } = nodeDimensions(m, data.connections);
    const { order } = pinOrder(m, data.connections);
    const sides: Record<string, 'left' | 'right'> = {};
    const ports: Record<string, { x: number; y: number }> = {};
    m.pins.forEach((p) => {
      const s = pinSide(m, p, data.connections);
      sides[p] = s === 'WEST' ? 'left' : 'right';
      // Always use our own side+order calculation for the rendered dot/label
      // position, the same one fed to ELK as each port's input coordinate —
      // never ELK's own (possibly reassigned) output port position. ELK is
      // free to move an unconnected port to whichever side minimizes edge
      // crossings regardless of the 'FIXED_SIDE' constraint we requested,
      // which desyncs the dot (drawn from ELK's position) from its label
      // (drawn from our independently-computed `sides`), overlapping them.
      // React Flow draws edges from its own Handle DOM positions anyway
      // (see WiringEdge), not ELK's routing, so this loses nothing.
      ports[p] = {
        x: s === 'WEST' ? 0 : width,
        y: 18 + (order[p] ?? 0) * PIN_SPACING,
      };
    });
    return {
      id: m.id,
      type: 'wiringModule',
      position: { x: child.x ?? 0, y: child.y ?? 0 },
      data: { module: m, width, height, sides, ports, highlighted: false },
      style: { width, height },
    };
  });

  const edges: Edge[] = data.connections.map(([src, srcPin, tgt, tgtPin, color]) => ({
    id: `${src}::${srcPin}->${tgt}::${tgtPin}`,
    source: src,
    target: tgt,
    sourceHandle: `${src}::${srcPin}`,
    targetHandle: `${tgt}::${tgtPin}`,
    type: 'wiringEdge',
    data: { color },
  }));

  return { nodes, edges };
}
