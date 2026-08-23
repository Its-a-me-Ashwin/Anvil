import { useState } from 'react';
import { ChevronDown, Cloud, Wifi } from 'lucide-react';

export default function TopBar() {
  const [open, setOpen] = useState(false);

  return (
    <div className="h-14 shrink-0 bg-anvil-panel border-b border-anvil-border flex items-center justify-between px-4 z-20">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">A</div>
          <span className="font-semibold tracking-tight text-white">ANVIL</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-anvil-panelHover border border-anvil-border hover:border-anvil-accent transition text-sm"
          >
            <span className="text-anvil-muted">Project:</span>
            <span className="font-medium text-white">Robot Actuator V1</span>
            <ChevronDown className="w-4 h-4 text-anvil-muted" />
          </button>

          {open && (
            <div className="absolute top-full left-0 mt-2 w-64 rounded-lg bg-anvil-panelHover border border-anvil-border shadow-xl z-50 overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold text-anvil-muted uppercase tracking-wider">Recent Projects</div>
              {[
                { name: 'Robot Actuator V1', status: 'active' },
                { name: 'RC Plane Telemetry', status: 'warning' },
                { name: 'Custom Drone Frame', status: 'idle' },
              ].map((p) => (
                <button
                  key={p.name}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-anvil-border flex items-center gap-2 text-anvil-text"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      p.status === 'active' ? 'bg-anvil-success' : p.status === 'warning' ? 'bg-anvil-warning' : 'bg-anvil-muted'
                    }`}
                  />
                  {p.name}
                </button>
              ))}
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-anvil-border text-anvil-text">+ New Project</button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          ACTIVE
        </div>
      </div>

      <div className="flex items-center gap-5 text-sm text-anvil-muted">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-anvil-success" />
          <span>Cloud: Google Cloud</span>
        </div>
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-anvil-success" />
          <span>Local Workshop</span>
        </div>
      </div>
    </div>
  );
}
