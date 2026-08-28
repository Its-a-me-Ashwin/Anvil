import { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Bot, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { chatProject, getSession, addSource } from '../services/agentService';
import { useActivityStore } from '../store/activityStore';
import ToolCallCard from './ToolCallCard';

export default function RightAgentPanel() {
  const [tab, setTab] = useState<'chat' | 'activity' | 'memory'>('chat');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef('');

  const { messages, currentProject, setCurrentProject, addMessage, refreshProjectState, loadSources } = useProjectStore();
  const { activities, clearActivities } = useActivityStore();

  useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    async function loadHistory() {
      if (!currentProject?.session_id) return;
      try {
        const data = await getSession(currentProject.session_id);
        // A send can already be in flight for this same project (e.g. we
        // just created it and are waiting on the first chat response) —
        // its optimistic messages are newer than whatever this fetch sees,
        // so don't clobber them with the not-yet-updated server history.
        if (sendingRef.current) return;
        const history = (data.messages || [])
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => (m.tool_calls?.length ? { role: m.role, text: m.text, tool_calls: m.tool_calls } : { role: m.role, text: m.text }));
        setCurrentProject(currentProject, history);
      } catch {
        // Leave messages empty if history cannot be loaded.
      }
    }
    loadHistory();
    if (currentProject?.id) refreshProjectState(currentProject.id);
  }, [currentProject?.id]);

  const handleSend = async () => {
    const text = input.trim();
    // Projects are created explicitly via the "New Project" button in
    // TopBar, not implicitly on first message — if there's none selected,
    // there's nothing to send to.
    if (!text || sending || !currentProject) return;

    addMessage('user', text);
    setInput('');
    setSending(true);

    try {
      const project = currentProject;
      const data = await chatProject(project.id, text);
      addMessage('assistant', data.response, data.tool_calls);
      if (project.name !== data.project_name) {
        setCurrentProject({ ...project, name: data.project_name });
      }
      // The agent may have called state tools during this turn (added a
      // constraint, checked off a progress item, etc.) — refresh after the
      // rename above so this isn't clobbered by setCurrentProject's clear.
      refreshProjectState(project.id);

      // Extract any URLs from the assistant response and add them as web sources.
      const urls = data.response.match(/https?:\/\/[^\s<>"'{}|\\^`\[\]]+/g) || [];
      const seen = new Set<string>();
      for (const url of urls) {
        if (seen.has(url)) continue;
        seen.add(url);
        try {
          const host = new URL(url).hostname.replace(/^www\./, '');
          await addSource(project.id, { type: 'web', title: host, url, added_at: new Date().toISOString() });
        } catch {
          // Ignore individual source tracking failures.
        }
      }
      if (urls.length > 0) {
        loadSources(project.id);
      }
    } catch (err: any) {
      addMessage('assistant', `Error: ${err?.message || 'Failed to reach agent.'}`);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addMessage('assistant', 'Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    baseTextRef.current = input ? input + ' ' : '';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) {
        baseTextRef.current += final + ' ';
      }
      setInput(baseTextRef.current + interim);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

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

      {tab === 'chat' && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-lg bg-anvil-panelHover border border-anvil-border p-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-anvil-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Working on {currentProject?.name || 'New Project'}</p>
                <p className="text-xs text-anvil-muted mt-0.5">Ask questions or give instructions to start designing.</p>
                <div className="w-full h-1.5 bg-anvil-bg rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-anvil-success w-[78%]" />
                </div>
              </div>
            </div>
          </div>

          {messages.map((msg, idx) =>
            msg.role === 'user' ? (
              <div key={idx} className="self-end bg-anvil-accent text-white rounded-2xl rounded-tr-sm p-3 text-xs leading-relaxed max-w-[92%] ml-auto">
                {msg.text}
              </div>
            ) : (
              <div key={idx} className="self-start bg-anvil-panelHover border border-anvil-border rounded-2xl rounded-tl-sm p-3 text-xs leading-relaxed text-anvil-text max-w-[92%]">
                <div className="flex items-center gap-2 mb-1.5">
                  <Bot className="w-3.5 h-3.5 text-anvil-accent" />
                  <span className="font-medium text-anvil-accent">Anvil</span>
                </div>
                {msg.tool_calls && msg.tool_calls.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {msg.tool_calls.map((call) => (
                      <ToolCallCard key={call.id} call={call} />
                    ))}
                  </div>
                )}
                {msg.text && <div>{msg.text}</div>}
              </div>
            )
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="flex items-center justify-between px-2 pb-1 border-b border-anvil-border">
            <span className="text-[10px] text-anvil-muted uppercase">Network requests</span>
            <button onClick={clearActivities} className="text-anvil-muted hover:text-white" title="Clear">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          {activities.length === 0 ? (
            <div className="text-xs text-anvil-muted text-center py-4">No requests yet</div>
          ) : (
            activities.map((a) => (
              <div key={a.id} className="px-2 py-1.5 rounded bg-anvil-panelHover border border-anvil-border text-[10px] font-mono">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-anvil-accent">{a.method}</span>
                  <span className={`font-medium ${a.status >= 200 && a.status < 300 ? 'text-green-400' : a.status >= 400 ? 'text-red-400' : 'text-anvil-muted'}`}>
                    {a.status || 'ERR'}
                  </span>
                </div>
                <div className="truncate text-anvil-text mt-0.5" title={a.url}>{a.url}</div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'memory' && (
        <div className="flex-1 overflow-y-auto p-4 text-xs text-anvil-muted">
          Memory view coming soon.
        </div>
      )}

      <div className="p-3 border-t border-anvil-border bg-anvil-panel shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-anvil-bg border border-anvil-border focus-within:border-anvil-accent">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentProject ? 'Ask Anvil anything or give an instruction...' : 'Click "New Project" above to start...'}
            className="flex-1 bg-transparent border-none outline-none text-xs text-anvil-text placeholder-anvil-muted"
            disabled={sending || !currentProject}
          />
          <button
            type="button"
            onClick={toggleMic}
            disabled={!currentProject}
            title={listening ? 'Stop recording' : 'Speak to type'}
            className={`disabled:opacity-50 ${listening ? 'text-red-500 animate-pulse' : 'text-anvil-muted hover:text-white'}`}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !input.trim() || !currentProject}
            className="w-7 h-7 rounded bg-anvil-accent hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center text-white"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
