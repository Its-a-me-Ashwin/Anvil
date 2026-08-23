import { useState } from 'react';
import { ChevronRight, Lock, Pencil, Zap, Cpu, Box, Wrench, Layers, CheckCircle2, Circle } from 'lucide-react';

type SectionKey = 'objective' | 'constraints' | 'inventory' | 'sources' | 'progress';

interface CollapsibleProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  action?: React.ReactNode;
}

function Collapsible({ title, open, onToggle, children, action }: CollapsibleProps) {
  return (
    <div className="border-b border-anvil-border last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-anvil-panelHover transition"
      >
        <span className="font-semibold text-sm text-anvil-text">{title}</span>
        <div className="flex items-center gap-2">
          {action}
          <ChevronRight className={`w-4 h-4 text-anvil-muted transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

export default function LeftProjectPanel() {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    objective: true,
    constraints: true,
    inventory: true,
    sources: false,
    progress: true,
  });

  const toggle = (key: SectionKey) => setOpen((s) => ({ ...s, [key]: !s[key] }));

  const inventory = [
    { name: '5010 BLDC Motor', qty: 1, status: 'available', icon: Zap },
    { name: 'ESP32 Dev Board', qty: 2, status: 'available', icon: Cpu },
    { name: '608 Bearing', qty: 4, status: 'available', icon: Box },
    { name: 'M3 Screws Assorted', qty: 12, status: 'low', icon: Wrench },
    { name: 'AS5600 Encoder', qty: 1, status: 'available', icon: Layers },
  ];

  const progress = [
    { label: 'Research & Planning', done: true },
    { label: 'Parts Sourcing', done: true },
    { label: 'CAD Design', done: false, active: true },
    { label: 'Fabrication', done: false },
    { label: 'Firmware', done: false },
    { label: 'Testing', done: false },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 h-12 border-b border-anvil-border flex items-center justify-between shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-anvil-muted">Project State</h2>
        <Pencil className="w-4 h-4 text-anvil-muted hover:text-white cursor-pointer" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <Collapsible
          title="Objective"
          open={open.objective}
          onToggle={() => toggle('objective')}
        >
          <p className="text-anvil-text leading-relaxed">
            Build a compact ~10:1 reduction actuator for a robot arm. Compactness over backlash; mostly 3D printed.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="px-1.5 py-0.5 rounded bg-anvil-border text-xs text-anvil-muted">Priority: Compact</span>
          </div>
        </Collapsible>

        <Collapsible
          title="Constraints"
          open={open.constraints}
          onToggle={() => toggle('constraints')}
        >
          <div className="mb-2 text-xs font-semibold text-anvil-muted uppercase">Locked</div>
          <ul className="space-y-1.5 mb-4">
            <li className="flex items-center gap-2 text-anvil-text">
              <Lock className="w-3.5 h-3.5 text-anvil-accent" /> Outer diameter ≤ 85 mm
            </li>
            <li className="flex items-center gap-2 text-anvil-text">
              <Lock className="w-3.5 h-3.5 text-anvil-accent" /> Motor: 5010 BLDC
            </li>
          </ul>
          <div className="mb-2 text-xs font-semibold text-anvil-muted uppercase">Flexible</div>
          <ul className="space-y-1.5">
            {['Bearing size', 'Reduction ratio', 'Wall thickness'].map((c) => (
              <li key={c} className="flex items-center gap-2 text-anvil-muted">
                <span className="w-3.5 h-3.5 rounded-full border border-anvil-muted" /> {c}
              </li>
            ))}
          </ul>
        </Collapsible>

        <Collapsible
          title="Inventory"
          open={open.inventory}
          onToggle={() => toggle('inventory')}
        >
          <div className="space-y-2">
            {inventory.map((item) => (
              <div key={item.name} className="flex items-center justify-between py-1 border-b border-anvil-border last:border-b-0">
                <div className="flex items-center gap-2">
                  <item.icon className="w-4 h-4 text-anvil-muted" />
                  <span className="text-anvil-text">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-anvil-muted">{item.qty}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      item.status === 'available' ? 'bg-anvil-success' : 'bg-anvil-warning'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </Collapsible>

        <Collapsible
          title="Data Sources"
          open={open.sources}
          onToggle={() => toggle('sources')}
        >
          <ul className="space-y-2">
            {[
              { name: 'AS5600 Datasheet', type: 'PDF' },
              { name: 'Reducer Geometry', type: 'YouTube' },
              { name: 'Onshape Model', type: 'CAD' },
              { name: 'GitHub Firmware', type: 'Repo' },
            ].map((s) => (
              <li key={s.name} className="flex items-center justify-between text-anvil-text">
                <span>{s.name}</span>
                <span className="text-xs text-anvil-accent">{s.type}</span>
              </li>
            ))}
          </ul>
        </Collapsible>

        <Collapsible
          title="Progress"
          open={open.progress}
          onToggle={() => toggle('progress')}
        >
          <div className="space-y-2.5">
            {progress.map((p) => (
              <div key={p.label} className={`flex items-center gap-2 ${p.active ? 'text-anvil-accent' : p.done ? 'text-anvil-text' : 'text-anvil-muted'}`}>
                {p.done ? (
                  <CheckCircle2 className="w-4 h-4 text-anvil-success" />
                ) : p.active ? (
                  <span className="w-4 h-4 rounded-full border-2 border-anvil-accent" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
                {p.label}
              </div>
            ))}
          </div>
        </Collapsible>
      </div>
    </div>
  );
}
