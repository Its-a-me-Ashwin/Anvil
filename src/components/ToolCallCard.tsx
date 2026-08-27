import { useState } from 'react';
import { ChevronRight, Wrench, CheckCircle2, Loader2 } from 'lucide-react';
import type { ToolCall } from '../services/agentService';

function pretty(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function CodeBlock({ label, value }: { label: string; value: unknown }) {
  const text = pretty(value);
  if (!text) return null;
  return (
    <div className="mt-2 first:mt-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-anvil-muted mb-1">{label}</div>
      <pre className="max-h-40 overflow-auto rounded-md bg-anvil-bg border border-anvil-border p-2 text-[11px] leading-relaxed text-anvil-text font-mono whitespace-pre">
        {text}
      </pre>
    </div>
  );
}

export default function ToolCallCard({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const hasResult = call.result !== null && call.result !== undefined;

  return (
    <div className="rounded-lg border border-anvil-border bg-anvil-bg/60 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-anvil-panelHover transition"
      >
        <ChevronRight className={`w-3 h-3 text-anvil-muted shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <Wrench className="w-3 h-3 text-anvil-accent shrink-0" />
        <span className="text-[11px] font-mono text-anvil-text truncate">{call.name}</span>
        <span className="ml-auto shrink-0">
          {hasResult ? (
            <CheckCircle2 className="w-3 h-3 text-anvil-success" />
          ) : (
            <Loader2 className="w-3 h-3 text-anvil-muted animate-spin" />
          )}
        </span>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5">
          <CodeBlock label="Input" value={call.args} />
          <CodeBlock label="Output" value={hasResult ? call.result : 'No result (call may not have completed)'} />
        </div>
      )}
    </div>
  );
}
