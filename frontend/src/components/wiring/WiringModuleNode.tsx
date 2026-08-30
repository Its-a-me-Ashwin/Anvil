import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { WiringNodeData } from './wiringLayout';

export default memo(function WiringModuleNode({ data, selected }: NodeProps<Node<WiringNodeData>>) {
  const { module, width, height, sides, ports, highlighted } = data;
  const borderColor = highlighted || selected ? '#3b82f6' : '#1f2433';

  return (
    <div
      className="rounded-md border bg-anvil-panel overflow-hidden shadow-sm"
      style={{ width, height, borderColor, transition: 'border-color 150ms' }}
    >
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <span className="text-sm font-medium text-anvil-text text-center truncate w-full">{module.name}</span>
      </div>
      {(module.pins || []).map((p) => {
        const side = sides[p] ?? 'right';
        const pos = ports[p] ?? { x: side === 'left' ? 0 : width, y: height / 2 };
        const labelStyle = side === 'left' ? { left: 10, top: pos.y - 8 } : { right: 10, top: pos.y - 8 };

        return (
          <div key={p}>
            <Handle
              id={`${module.id}::${p}`}
              type={side === 'left' ? 'target' : 'source'}
              position={side === 'left' ? Position.Left : Position.Right}
              style={{
                left: pos.x,
                top: pos.y,
                transform: 'translate(-50%, -50%)',
                width: 8,
                height: 8,
                background: 'transparent',
                border: 'none',
              }}
            />
            <div
              className="absolute w-2 h-2 rounded-full bg-anvil-accent"
              style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)' }}
            />
            <span
              className="absolute text-[10px] text-anvil-muted whitespace-nowrap"
              style={labelStyle}
            >
              {p}
            </span>
          </div>
        );
      })}
    </div>
  );
});
