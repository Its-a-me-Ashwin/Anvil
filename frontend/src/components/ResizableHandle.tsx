import { useState, useEffect, useCallback } from 'react';

interface ResizableHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
}

export default function ResizableHandle({ direction, onResize, onResizeEnd }: ResizableHandleProps) {
  const [dragging, setDragging] = useState(false);
  const isHorizontal = direction === 'horizontal';

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    let lastX = 0;
    let lastY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - lastX;
      const deltaY = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      onResize(isHorizontal ? deltaX : deltaY);
    };

    const handleMouseUp = () => {
      setDragging(false);
      onResizeEnd?.();
    };

    const handleFirstMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      window.addEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousemove', handleFirstMove);
    };

    window.addEventListener('mousemove', handleFirstMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });

    return () => {
      window.removeEventListener('mousemove', handleFirstMove);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, isHorizontal, onResize, onResizeEnd]);

  return (
    <>
      {dragging && (
        <div
          className="fixed inset-0 z-[100]"
          style={{ cursor: isHorizontal ? 'col-resize' : 'row-resize' }}
        />
      )}
      <div
        onMouseDown={handleMouseDown}
        className={`
          relative shrink-0 flex items-center justify-center z-20
          transition-colors select-none
          ${isHorizontal ? 'w-3 cursor-col-resize' : 'h-3 cursor-row-resize'}
          ${dragging ? 'bg-anvil-accent' : 'bg-anvil-border hover:bg-anvil-accent'}
        `}
      >
        <div
          className={`
            rounded-full bg-anvil-muted/70 pointer-events-none
            ${isHorizontal ? 'w-1 h-8' : 'h-1 w-8'}
          `}
        />
      </div>
    </>
  );
}
