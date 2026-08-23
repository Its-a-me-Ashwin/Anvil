import { Video, FileText, Image as ImageIcon, Plus, Radio } from 'lucide-react';

export default function BottomDataStrip() {
  const sources = [
    { title: 'Bambu Printer', type: 'Live', icon: Radio, status: 'live' },
    { title: 'Reducer Geometry', type: 'YouTube', icon: Video, status: 'idle' },
    { title: 'AS5600.pdf', type: 'PDF', icon: FileText, status: 'idle' },
    { title: 'Electronics Bench', type: 'RTSP', icon: Radio, status: 'live' },
    { title: 'Mount Sketch', type: 'Image', icon: ImageIcon, status: 'idle' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 h-8 flex items-center justify-between border-b border-anvil-border shrink-0">
        <span className="text-xs font-semibold text-anvil-muted uppercase tracking-wider">Open Data Sources</span>
        <button className="text-anvil-muted hover:text-white">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-x-auto p-3 flex items-stretch gap-3">
        {sources.map((s) => (
          <div
            key={s.title}
            className="w-56 shrink-0 flex flex-col rounded-lg bg-anvil-bg border border-anvil-border overflow-hidden cursor-pointer hover:border-anvil-accent transition"
          >
            <div className="px-2.5 py-1.5 border-b border-anvil-border flex items-center justify-between">
              <span className="text-xs font-medium text-anvil-text flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    s.status === 'live' ? 'bg-anvil-danger animate-pulse' : 'bg-anvil-muted'
                  }`}
                />
                {s.title}
              </span>
              <span className="text-[10px] text-anvil-muted">{s.type}</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <s.icon className="w-8 h-8 text-anvil-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
