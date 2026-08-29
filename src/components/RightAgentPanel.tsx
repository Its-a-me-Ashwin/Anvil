import { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Bot, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { chatProject, getSession, type ToolCall } from '../services/agentService';
import { useActivityStore } from '../store/activityStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { resolveWorkspacePath } from '../services/fileService';
import { buildVsCodeOpenUrl } from '../lib/vscodeLink';
import { getWiringDiagram } from '../services/circuitService';
import { animationUrl } from '../services/animationService';
import { musicUrl } from '../services/musicService';
import ToolCallCard from './ToolCallCard';

const FILE_WRITE_TOOLS = new Set(['write_file', 'edit_file']);
const CIRCUIT_WRITE_TOOLS = new Set(['create_wiring_diagram', 'update_wiring_diagram']);
const ANIMATION_TOOL = 'generate_animation';
const TUTORIAL_VIDEO_TOOL = 'find_tutorial_video';
const MUSIC_TOOLS = new Set(['generate_soundtrack', 'score_animation']);
const CAD_WRITE_TOOLS = new Set([
  'add_box', 'add_cylinder', 'add_tube', 'add_sphere', 'add_cone',
  'position_part', 'remove_part', 'boolean_op', 'drill_hole',
  'fillet_part', 'chamfer_part',
]);

// Whenever this turn's tool calls wrote or edited a file, pull the real VS
// Code Server tab to the front and deep-link it straight to that file (or
// all of them, if several were touched), instead of making the user hunt
// for the "VS Code" tab and open it themselves.
async function openTouchedFiles(toolCalls: ToolCall[] | undefined) {
  const paths = Array.from(
    new Set(
      (toolCalls || [])
        .filter((c) => FILE_WRITE_TOOLS.has(c.name) && typeof c.args?.path === 'string')
        .map((c) => c.args.path as string)
    )
  );
  if (paths.length === 0) return;

  const absPaths: string[] = [];
  for (const path of paths) {
    try {
      const { abs_path } = await resolveWorkspacePath(path);
      absPaths.push(abs_path);
    } catch {
      // File may have been removed since, or lies outside the allowed root.
    }
  }
  if (absPaths.length === 0) return;

  const url = buildVsCodeOpenUrl(absPaths);
  const { tabs, addTab, updateTab, setActiveTab } = useWorkspaceStore.getState();
  const existing = tabs.find((t) => t.type === 'codeserver');
  if (existing) {
    updateTab(existing.id, { url });
    setActiveTab(existing.id);
  } else {
    addTab({ title: 'VS Code', type: 'codeserver', url });
  }
}

// Whenever this turn's tool calls created, updated, or deleted the
// project's wiring diagram, pull the Wiring Diagram tab to the front with
// the latest version, instead of making the user open it themselves from
// the "+" menu.
async function openCircuitViewer(toolCalls: ToolCall[] | undefined, projectId: string) {
  const names = new Set((toolCalls || []).map((c) => c.name));
  const { tabs, addTab, updateTab, setActiveTab, closeTab } = useWorkspaceStore.getState();
  const existing = tabs.find((t) => t.type === 'wiring');

  const wasDeleted = names.has('delete_wiring_diagram');
  const wasWritten = [...names].some((n) => CIRCUIT_WRITE_TOOLS.has(n));
  if (!wasDeleted && !wasWritten) return;

  if (wasDeleted && !wasWritten) {
    if (existing) closeTab(existing.id);
    return;
  }

  try {
    const content = JSON.stringify(await getWiringDiagram(projectId));
    if (existing) {
      updateTab(existing.id, { content });
      setActiveTab(existing.id);
    } else {
      addTab({ title: 'Wiring Diagram', type: 'wiring', content });
    }
  } catch {
    // Nothing to show if the fetch races with a delete in the same turn.
  }
}

// Whenever this turn's tool calls generated an animation (generate_animation
// returned status "ready", not "needs_confirmation"), pull the finished MP4
// straight into a video tab instead of making the user go find the file.
function openAnimationViewer(toolCalls: ToolCall[] | undefined, projectId: string) {
  const call = (toolCalls || []).find((c) => c.name === ANIMATION_TOOL);
  if (!call) return;

  const result = call.result as { status?: string; filename?: string } | undefined;
  if (!result || result.status !== 'ready' || !result.filename) return;

  const url = animationUrl(projectId, result.filename);
  const { tabs, addTab, updateTab, setActiveTab } = useWorkspaceStore.getState();
  const existing = tabs.find((t) => t.type === 'video' && t.title === 'Animation');
  if (existing) {
    updateTab(existing.id, { url });
    setActiveTab(existing.id);
  } else {
    addTab({ title: 'Animation', type: 'video', url });
  }
}

// Whenever this turn's tool calls found an existing YouTube tutorial
// (find_tutorial_video returned status "found" — the cost-free alternative
// to generate_animation), pull it into a YouTube tab instead of making the
// user go find it themselves.
function openTutorialVideoViewer(toolCalls: ToolCall[] | undefined) {
  const call = (toolCalls || []).find((c) => c.name === TUTORIAL_VIDEO_TOOL);
  if (!call) return;

  const result = call.result as { status?: string; embed_url?: string; title?: string } | undefined;
  if (!result || result.status !== 'found' || !result.embed_url) return;

  const { tabs, addTab, updateTab, setActiveTab } = useWorkspaceStore.getState();
  const existing = tabs.find((t) => t.type === 'youtube' && t.title === 'Tutorial Video');
  if (existing) {
    updateTab(existing.id, { url: result.embed_url });
    setActiveTab(existing.id);
  } else {
    addTab({ title: 'Tutorial Video', type: 'youtube', url: result.embed_url });
  }
}

// Whenever this turn's tool calls produced a track (generate_soundtrack —
// a standalone clip — or score_animation — an existing animation with one
// muxed in, both returning status "ready"), pull the result into a video
// tab. A plain <video> element happily plays an audio-only .wav source
// (native controls, no picture) so this reuses the same tab type as
// animations/tutorials rather than adding a dedicated audio player just
// for this one case.
function openMusicViewer(toolCalls: ToolCall[] | undefined, projectId: string) {
  const call = (toolCalls || []).find((c) => MUSIC_TOOLS.has(c.name));
  if (!call) return;

  const result = call.result as { status?: string; filename?: string } | undefined;
  if (!result || result.status !== 'ready' || !result.filename) return;

  const url = musicUrl(projectId, result.filename);
  const title = call.name === 'score_animation' ? 'Scored Animation' : 'Soundtrack';
  const { tabs, addTab, updateTab, setActiveTab } = useWorkspaceStore.getState();
  const existing = tabs.find((t) => t.type === 'video' && t.title === title);
  if (existing) {
    updateTab(existing.id, { url });
    setActiveTab(existing.id);
  } else {
    addTab({ title, type: 'video', url });
  }
}

// Whenever this turn's tool calls edited the project's CAD assembly, pull
// the Bambu Slicer tab (which doubles as the live STL viewer — see
// SlicerWorkspace's own CAD-polling effect) to the front, instead of making
// the user open it themselves from the "+" menu.
function openCadViewer(toolCalls: ToolCall[] | undefined) {
  const wasWritten = (toolCalls || []).some((c) => CAD_WRITE_TOOLS.has(c.name));
  if (!wasWritten) return;

  const { tabs, addTab, setActiveTab } = useWorkspaceStore.getState();
  const existing = tabs.find((t) => t.type === 'slicer');
  if (existing) {
    setActiveTab(existing.id);
  } else {
    addTab({ title: 'Bambu Slicer', type: 'slicer' });
  }
}

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
      openTouchedFiles(data.tool_calls);
      openCircuitViewer(data.tool_calls, project.id);
      openAnimationViewer(data.tool_calls, project.id);
      openTutorialVideoViewer(data.tool_calls);
      openMusicViewer(data.tool_calls, project.id);
      openCadViewer(data.tool_calls);
      if (project.name !== data.project_name) {
        setCurrentProject({ ...project, name: data.project_name });
      }
      // The agent may have called state tools during this turn (added a
      // constraint, checked off a progress item, etc.) — refresh after the
      // rename above so this isn't clobbered by setCurrentProject's clear.
      refreshProjectState(project.id);

      // The backend auto-adds a source for every URL Gemini's search
      // grounding actually surfaced this turn (see _grounding_sources in
      // server.py) — just pick up whatever it wrote.
      loadSources(project.id);
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
