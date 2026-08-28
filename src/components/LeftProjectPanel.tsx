import { useState } from 'react';
import { ChevronRight, Lock, Pencil, Zap, CheckCircle2, Circle } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';

type SectionKey = 'objective' | 'constraints' | 'inventory' | 'progress';

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

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-anvil-muted italic">{text}</p>;
}

export default function LeftProjectPanel() {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    objective: true,
    constraints: true,
    inventory: true,
    progress: true,
  });

  const toggle = (key: SectionKey) => setOpen((s) => ({ ...s, [key]: !s[key] }));

  const { currentProject, projectState } = useProjectStore();

  if (!currentProject) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="px-4 h-12 border-b border-anvil-border flex items-center shrink-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-anvil-muted">Project State</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-xs text-anvil-muted text-center">
            Click "New Project" above to start — the agent will fill this panel in as you talk to it.
          </p>
        </div>
      </div>
    );
  }

  const lockedConstraints = (projectState?.constraints || []).filter((c) => c.locked);
  const flexibleConstraints = (projectState?.constraints || []).filter((c) => !c.locked);
  const openObjectives = (projectState?.objectives || []).filter((o) => o.status !== 'done');
  const doneObjectives = (projectState?.objectives || []).filter((o) => o.status === 'done');
  const firstOpenId = openObjectives[0]?.id;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 h-12 border-b border-anvil-border flex items-center justify-between shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-anvil-muted">Project State</h2>
        <Pencil className="w-4 h-4 text-anvil-muted hover:text-white cursor-pointer" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <Collapsible title="Objective" open={open.objective} onToggle={() => toggle('objective')}>
          {projectState?.objective ? (
            <>
              <p className="text-anvil-text leading-relaxed">{projectState.objective}</p>
              {projectState.objective_priority && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-anvil-border text-xs text-anvil-muted">
                    Priority: {projectState.objective_priority}
                  </span>
                </div>
              )}
            </>
          ) : (
            <Empty text="No objective set yet — tell the agent what you're building." />
          )}
        </Collapsible>

        <Collapsible title="Constraints" open={open.constraints} onToggle={() => toggle('constraints')}>
          <div className="mb-2 text-xs font-semibold text-anvil-muted uppercase">Locked</div>
          {lockedConstraints.length === 0 ? (
            <Empty text="No locked constraints yet." />
          ) : (
            <ul className="space-y-1.5 mb-4">
              {lockedConstraints.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-anvil-text">
                  <Lock className="w-3.5 h-3.5 text-anvil-accent shrink-0" /> {c.text}
                </li>
              ))}
            </ul>
          )}
          <div className="mb-2 text-xs font-semibold text-anvil-muted uppercase">Flexible</div>
          {flexibleConstraints.length === 0 ? (
            <Empty text="No flexible constraints yet." />
          ) : (
            <ul className="space-y-1.5">
              {flexibleConstraints.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-anvil-muted">
                  <span className="w-3.5 h-3.5 rounded-full border border-anvil-muted shrink-0" /> {c.text}
                </li>
              ))}
            </ul>
          )}
        </Collapsible>

        <Collapsible title="Inventory" open={open.inventory} onToggle={() => toggle('inventory')}>
          {(projectState?.inventory || []).length === 0 ? (
            <Empty text="No inventory tracked yet." />
          ) : (
            <div className="space-y-2">
              {(projectState?.inventory || []).map((item) => (
                <div key={item.id} className="flex items-center justify-between py-1 border-b border-anvil-border last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-anvil-muted" />
                    <span className="text-anvil-text">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-anvil-muted">{item.quantity}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.status === 'available' ? 'bg-anvil-success' : 'bg-anvil-warning'
                      }`}
                      title={item.status}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Collapsible>

        <Collapsible title="Progress" open={open.progress} onToggle={() => toggle('progress')}>
          {(projectState?.objectives || []).length === 0 ? (
            <Empty text="No progress items yet." />
          ) : (
            <div className="space-y-2.5">
              {[...doneObjectives, ...openObjectives].map((o) => {
                const isActive = o.id === firstOpenId;
                return (
                  <div
                    key={o.id}
                    className={`flex items-center gap-2 ${
                      isActive ? 'text-anvil-accent' : o.status === 'done' ? 'text-anvil-text' : 'text-anvil-muted'
                    }`}
                  >
                    {o.status === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 text-anvil-success shrink-0" />
                    ) : isActive ? (
                      <span className="w-4 h-4 rounded-full border-2 border-anvil-accent shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 shrink-0" />
                    )}
                    {o.title}
                  </div>
                );
              })}
            </div>
          )}
        </Collapsible>
      </div>
    </div>
  );
}
