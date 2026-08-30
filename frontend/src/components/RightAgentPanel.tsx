import { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Bot, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { chatProjectStream, getSession, type ToolCall } from '../services/agentService';
import { useActivityStore } from '../store/activityStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useLocalFilesystemStore } from '../store/localFilesystemStore';
import { executeFilesystemTool, isFilesystemTool } from '../lib/localFilesystem';
import { resolveRemoteToolCall, rejectRemoteToolCall, getPendingRemoteCalls } from '../services/remoteToolService';
import { buildVsCodeOpenUrl } from '../lib/vscodeLink';
import { getWiringDiagram } from '../services/circuitService';
import { animationUrl } from '../services/animationService';
import ToolCallGroup from './ToolCallGroup';
import MemoryPanel from './MemoryPanel';
import MarkdownMessage from './MarkdownMessage';

const FILE_WRITE_TOOLS = new Set(['write_file', 'edit_file']);
const CIRCUIT_WRITE_TOOLS = new Set(['create_wiring_diagram', 'update_wiring_diagram']);
const ANIMATION_TOOL = 'generate_animation';
const TUTORIAL_VIDEO_TOOL = 'find_tutorial_video';
const CAD_WRITE_TOOLS = new Set([
  'add_box', 'add_cylinder', 'add_tube', 'add_sphere', 'add_cone',
  'position_part', 'remove_part', 'boolean_op', 'drill_hole',
  'fillet_part', 'chamfer_part',
]);

// Whenever this turn's tool calls wrote or edited a file, pull the embedded
// VS Code: tab to the selected project folder so the user sees the whole
// directory, not just a single file. The absolute path is supplied separately
// because the File System Access API does not expose full paths.
function openTouchedFiles(toolCalls: ToolCall[] | undefined) {
  const written = (toolCalls || []).some((c) => FILE_WRITE_TOOLS.has(c.name) && typeof c.args?.path === 'string');
  if (!written) return;

  const rootPath = useLocalFilesystemStore.getState().rootPath;
  if (!rootPath) return;

  const { tabs, addTab, updateTab, setActiveTab } = useWorkspaceStore.getState();
  const codeServerUrl = buildVsCodeOpenUrl([], rootPath);
  const existing = tabs.find((t) => t.type === 'codeserver');
  if (existing) {
    updateTab(existing.id, { url: codeServerUrl });
    setActiveTab(existing.id);
  } else {
    addTab({ title: 'VS Code', type: 'codeserver', url: codeServerUrl });
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
  const stickToBottomRef = useRef(true);
  const sendingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef('');
  const codeServerFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (codeServerFlushRef.current) clearTimeout(codeServerFlushRef.current);
    };
  }, []);

  const {
    messages,
    currentProject,
    setCurrentProject,
    addMessage,
    beginAssistantMessage,
    appendToolCall,
    updateToolCallResult,
    appendAssistantText,
    finishAssistantMessage,
    refreshProjectState,
    loadSources,
    projectState,
  } = useProjectStore();
  const { activities, clearActivities } = useActivityStore();

  useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);

  // Keep the transcript pinned to the bottom while streaming, but do it
  // without the jitter the naive version caused. Two changes matter:
  // (1) only auto-scroll when the user is already near the bottom, so a tool
  //     card collapsing (which shrinks content height) can't yank the view
  //     while they're reading further up; and
  // (2) defer the scroll to the next animation frame, so it reads the height
  //     *after* the collapse/expand has laid out — no overshoot-then-clamp
  //     bounce.
  const onTranscriptScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  };

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
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
    beginAssistantMessage();

    try {
      const project = currentProject;
      // Tracked locally (not the store) so each viewer-opening helper below
      // can see the full set of calls made so far in this turn, including
      // the one that just resolved — that's what lets e.g. the VS Code tab
      // open right after the first write_file finishes, instead of waiting
      // for the whole streamed turn to end.
      const toolCallsSoFar: ToolCall[] = [];

      const resolveFilesystemCall = async (call: ToolCall) => {
        const root = useLocalFilesystemStore.getState().rootHandle;
        if (!root) {
          await rejectRemoteToolCall(call.id, 'No local project folder selected. Open Settings and choose a project folder.');
          return;
        }
        const path = typeof call.args?.path === 'string' ? call.args.path : '';
        // The backend emits ADK's tool-call id, but the remote filesystem
        // adapter registered the call under its own UUID. Poll pending calls
        // to find the matching remote call id by tool name + path.
        let remoteId: string | undefined;
        for (let attempt = 0; attempt < 30; attempt++) {
          const pending = await getPendingRemoteCalls();
          remoteId = pending.find((p) => p.tool === call.name && p.path === path)?.call_id;
          if (remoteId) break;
          await new Promise((r) => setTimeout(r, 100));
        }
        if (!remoteId) {
          await rejectRemoteToolCall(call.id, 'Backend did not register the filesystem call — is the remote adapter loaded?');
          return;
        }
        try {
          const result = await executeFilesystemTool(root, call);
          await resolveRemoteToolCall(remoteId, result);
        } catch (err: any) {
          await rejectRemoteToolCall(remoteId, err?.message || String(err));
        }
      };

      const data = await chatProjectStream(project.id, text, {
        onToolCall: (call) => {
          toolCallsSoFar.push(call);
          appendToolCall(call);

          if (isFilesystemTool(call)) {
            resolveFilesystemCall(call).catch(() => {});
          }
        },
        onToolResult: (id, result) => {
          const idx = toolCallsSoFar.findIndex((c) => c.id === id);
          if (idx !== -1) toolCallsSoFar[idx] = { ...toolCallsSoFar[idx], result };
          updateToolCallResult(id, result);
          if (codeServerFlushRef.current) clearTimeout(codeServerFlushRef.current);
          codeServerFlushRef.current = setTimeout(() => {
            openTouchedFiles(toolCallsSoFar);
          }, 400);
          openCircuitViewer(toolCallsSoFar, project.id);
          openAnimationViewer(toolCallsSoFar, project.id);
          openTutorialVideoViewer(toolCallsSoFar);
          openCadViewer(toolCallsSoFar);
        },
        onText: appendAssistantText,
      });
      finishAssistantMessage({ text: data.response, tool_calls: data.tool_calls });
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
      finishAssistantMessage({ text: `Error: ${err?.message || 'Failed to reach agent.'}` });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

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
        <div ref={scrollRef} onScroll={onTranscriptScroll} className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  <ToolCallGroup calls={msg.tool_calls} streaming={msg.streaming} />
                )}
                {msg.text && <MarkdownMessage text={msg.text} />}
                {msg.streaming && !msg.text && (!msg.tool_calls || msg.tool_calls.length === 0) && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-anvil-muted" />
                )}
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

      {tab === 'memory' && currentProject && (
        <MemoryPanel projectId={currentProject.id} skills={projectState?.skills || []} />
      )}

      <div className="p-3 border-t border-anvil-border bg-anvil-panel shrink-0">
        <div className="flex items-end gap-2 px-3 py-2 rounded-lg bg-anvil-bg border border-anvil-border focus-within:border-anvil-accent">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentProject ? 'Ask Anvil anything or give an instruction...' : 'Click "New Project" above to start...'}
            className="flex-1 bg-transparent border-none outline-none resize-none text-xs text-anvil-text placeholder-anvil-muted leading-relaxed py-1 max-h-40 overflow-y-auto"
            disabled={sending || !currentProject}
          />
          <button
            type="button"
            onClick={toggleMic}
            disabled={!currentProject}
            title={listening ? 'Stop recording' : 'Speak to type'}
            className={`shrink-0 mb-1 disabled:opacity-50 ${listening ? 'text-red-500 animate-pulse' : 'text-anvil-muted hover:text-white'}`}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !input.trim() || !currentProject}
            className="shrink-0 w-7 h-7 rounded bg-anvil-accent hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center text-white"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
