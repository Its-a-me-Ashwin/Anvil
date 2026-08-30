import { Separator } from 'react-resizable-panels';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
}

export default function ResizeHandle({ direction }: ResizeHandleProps) {
  const isHorizontal = direction === 'horizontal';

  return (
    <Separator
      className={`
        relative shrink-0 flex items-center justify-center
        bg-anvil-border hover:bg-anvil-accent active:bg-anvil-accent
        transition-colors z-10
        ${isHorizontal ? 'w-4 cursor-col-resize' : 'h-4 cursor-row-resize'}
      `}
    >
      <div
        className={`
          rounded-full bg-anvil-muted/60
          ${isHorizontal ? 'w-1 h-8' : 'h-1 w-8'}
        `}
      />
    </Separator>
  );
}
