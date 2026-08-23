import { useState } from 'react';
import { Send, Mic, Bot, CheckCircle2 } from 'lucide-react';

export default function RightAgentPanel() {
  const [tab, setTab] = useState<'chat' | 'activity' | 'memory'>('chat');
  const [input, setInput] = useState('');

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 h-12 border-b border-anvil-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">AI</div>
          <span className="font-semibold text-sm">Anvil Agent</span>
        </div>
        <button className="text-anvil-muted hover:text-white text-xs">Clear</button>
      </div>

      <div className="h-9 flex items-center px-2 border-b border-anvil-border bg-anvil-panel gap-1 shrink-0">
        {(['chat', 'activity', 'memory'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition ${
              tab === t ? 'bg-anvil-border text-white' : 'text-anvil-muted hover:bg-anvil-panelHover'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-lg bg-anvil-panelHover border border-anvil-border p-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-anvil-success" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Working on CAD Design</p>
              <p className="text-xs text-anvil-muted mt-0.5">Designing actuator housing with 608 bearing.</p>
              <div className="w-full h-1.5 bg-anvil-bg rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-anvil-success w-[78%]" />
              </div>
            </div>
          </div>
        </div>

        <div className="self-start bg-anvil-panelHover border border-anvil-border rounded-2xl rounded-tl-sm p-3 text-xs leading-relaxed text-anvil-text max-w-[92%]">
          <div className="flex items-center gap-2 mb-1.5">
            <Bot className="w-3.5 h-3.5 text-anvil-accent" />
            <span className="font-medium text-anvil-accent">Anvil</span>
          </div>
          I've updated the design to use the 608 bearing from your inventory. This increases the housing width by 5 mm but keeps everything else within constraints.
        </div>

        <div className="self-end bg-anvil-accent text-white rounded-2xl rounded-tr-sm p-3 text-xs leading-relaxed max-w-[92%] ml-auto">
          Looks good. Don't change the motor mount pattern or outer diameter.
        </div>
      </div>

      <div className="p-3 border-t border-anvil-border bg-anvil-panel shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-anvil-bg border border-anvil-border focus-within:border-anvil-accent">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Anvil anything or give an instruction..."
            className="flex-1 bg-transparent border-none outline-none text-xs text-anvil-text placeholder-anvil-muted"
          />
          <button className="text-anvil-muted hover:text-white">
            <Mic className="w-4 h-4" />
          </button>
          <button className="w-7 h-7 rounded bg-anvil-accent hover:bg-blue-600 flex items-center justify-center text-white">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
