import { useState, useCallback } from 'react';
import TopBar from './components/TopBar';
import LeftProjectPanel from './components/LeftProjectPanel';
import CenterWorkspace from './components/CenterWorkspace';
import RightAgentPanel from './components/RightAgentPanel';
import BottomDataStrip from './components/BottomDataStrip';
import ResizableHandle from './components/ResizableHandle';
import PrinterAlertBanner from './components/PrinterAlertBanner';

const MIN_LEFT = 220;
const MAX_LEFT = 500;
const MIN_RIGHT = 260;
const MAX_RIGHT = 500;
const MIN_BOTTOM = 120;
const MAX_BOTTOM = 500;

function App() {
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(320);
  const [bottomHeight, setBottomHeight] = useState(180);

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((w) => Math.max(MIN_LEFT, Math.min(MAX_LEFT, w + delta)));
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    // Dragging the right handle to the right increases the right panel width
    setRightWidth((w) => Math.max(MIN_RIGHT, Math.min(MAX_RIGHT, w - delta)));
  }, []);

  const handleBottomResize = useCallback((delta: number) => {
    // Dragging down increases the bottom panel height
    setBottomHeight((h) => Math.max(MIN_BOTTOM, Math.min(MAX_BOTTOM, h - delta)));
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-anvil-bg text-anvil-text overflow-hidden">
      <TopBar />
      <PrinterAlertBanner />

      <div className="flex-1 flex flex-row min-h-0">
        <div style={{ width: leftWidth, minWidth: MIN_LEFT, maxWidth: MAX_LEFT }} className="bg-anvil-panel flex flex-col">
          <LeftProjectPanel />
        </div>

        <ResizableHandle direction="horizontal" onResize={handleLeftResize} />

        {/* Center workspace + bottom data strip stacked; right panel sits
            outside this column so chat spans the full app height. */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 bg-anvil-bg flex flex-col">
            <CenterWorkspace />
          </div>

          <ResizableHandle direction="vertical" onResize={handleBottomResize} />

          <div style={{ height: bottomHeight, minHeight: MIN_BOTTOM, maxHeight: MAX_BOTTOM }} className="bg-anvil-panel flex flex-col">
            <BottomDataStrip />
          </div>
        </div>

        <ResizableHandle direction="horizontal" onResize={handleRightResize} />

        <div style={{ width: rightWidth, minWidth: MIN_RIGHT, maxWidth: MAX_RIGHT }} className="bg-anvil-panel flex flex-col">
          <RightAgentPanel />
        </div>
      </div>
    </div>
  );
}

export default App;
