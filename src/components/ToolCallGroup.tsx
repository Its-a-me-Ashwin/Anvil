import { useEffect, useState } from 'react';
import { ChevronRight, Wrench } from 'lucide-react';
import type { ToolCall } from '../services/agentService';
import ToolCallCard from './ToolCallCard';

// Groups a turn's tool calls under one collapsible header. While the turn is
// still streaming in, the group stays open so each call's input/output is
// visible as it runs; the instant the turn finishes, it auto-collapses down
// to just the header.
export default function ToolCallGroup({ calls, streaming }: { calls: ToolCall[]; streaming?: boolean }) {
  const [open, setOpen] = useState(!!streaming);

  useEffect(() => {
    if (!streaming) setOpen(false);
  }, [streaming]);

  if (calls.length === 0) return null;

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-1 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-anvil-muted hover:text-white transition"
      >
        <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <Wrench className="w-3 h-3 shrink-0" />
        <span>{calls.length} tool call{calls.length > 1 ? 's' : ''}</span>
      </button>
      {open && (
        <div className="space-y-1.5 mt-1">
          {calls.map((call) => (
            <ToolCallCard key={call.id} call={call} autoManage={streaming} />
          ))}
        </div>
      )}
    </div>
  );
}
