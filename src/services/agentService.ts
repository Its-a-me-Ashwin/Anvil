const API_BASE = import.meta.env.VITE_ANVIL_API_URL || 'http://localhost:8000';

export interface SourceItem {
  type: string;
  title: string;
  url?: string | null;
  added_at?: string | null;
  domain?: string | null;
}

export interface Project {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
  session_id?: string;
  sources?: SourceItem[];
}

export interface ProjectListResponse {
  projects: Project[];
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface ChatResponse {
  response: string;
  project_name: string;
  tool_calls?: ToolCall[];
}

export interface ChatStreamHandlers {
  onToolCall?: (call: ToolCall) => void;
  onToolResult?: (id: string, result: unknown) => void;
  onText?: (text: string) => void;
}

export interface SessionResponse {
  session_id: string;
  messages: { role: string; text: string; tool_calls?: ToolCall[] }[];
}

export interface Constraint {
  id: string;
  text: string;
  locked: boolean;
  source?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface ObjectiveItem {
  id: string;
  title: string;
  status: 'open' | 'done';
  completed_at?: string | null;
  created_at?: string;
  assigned_tool?: string | null;
}

export interface Decision {
  id: string;
  summary: string;
  requires_approval: boolean;
  approved: boolean;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at?: string;
}

export interface DataSource {
  id: string;
  title: string;
  url: string;
  type: string;
  source?: string;
  created_at?: string;
}

export interface SkillStatement {
  id: string;
  text: string;
  created_at?: string;
}

export interface SkillCategoryState {
  id: string;
  category: string;
  level: number;
  statements: SkillStatement[];
  updated_at?: string;
}

export interface ProjectState {
  project_id: string;
  objective: string | null;
  objective_priority: string | null;
  constraints: Constraint[];
  inventory: InventoryItem[];
  objectives: ObjectiveItem[];
  decisions: Decision[];
  data_sources: DataSource[];
  skills: SkillCategoryState[];
  artifacts: unknown[];
}

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function createProject(name?: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name || 'New Project' }),
  });
  return handleJson<Project>(res);
}

export async function listProjects(): Promise<ProjectListResponse> {
  const res = await fetch(`${API_BASE}/projects`);
  return handleJson<ProjectListResponse>(res);
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects/${id}`);
  return handleJson<Project>(res);
}

// The backend streams this turn's tool calls (and their results) as
// Server-Sent Events as they happen, instead of one JSON blob once the whole
// agent loop finishes — that's what lets the UI show each tool call live
// rather than having them all pop in at once at the end.
export async function chatProjectStream(
  id: string,
  message: string,
  handlers: ChatStreamHandlers = {}
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/projects/${id}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`API error ${res.status}: ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done: ChatResponse | null = null;

  while (true) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex: number;
    while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);

      let eventType = 'message';
      let data = '';
      for (const line of rawEvent.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7);
        else if (line.startsWith('data: ')) data = line.slice(6);
      }
      if (!data) continue;
      const parsed = JSON.parse(data);

      if (eventType === 'tool_call') handlers.onToolCall?.(parsed);
      else if (eventType === 'tool_result') handlers.onToolResult?.(parsed.id, parsed.result);
      else if (eventType === 'text') handlers.onText?.(parsed.text);
      else if (eventType === 'done') done = parsed;
    }
  }

  if (!done) throw new Error('Agent stream ended without a final response.');
  return done;
}

export async function getSession(sessionId: string): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
  return handleJson<SessionResponse>(res);
}

export async function getProjectState(id: string): Promise<ProjectState> {
  const res = await fetch(`${API_BASE}/projects/${id}/state`);
  return handleJson<ProjectState>(res);
}

export interface SourcesResponse {
  sources: SourceItem[];
}

export async function getSources(projectId: string): Promise<SourcesResponse> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/sources`);
  return handleJson<SourcesResponse>(res);
}

export async function addSource(projectId: string, item: SourceItem): Promise<SourceItem> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  return handleJson<SourceItem>(res);
}

export async function removeSkillStatement(
  projectId: string,
  category: string,
  statementId: string
): Promise<SkillCategoryState> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/skills/${encodeURIComponent(category)}/statements/${encodeURIComponent(statementId)}`,
    { method: 'DELETE' }
  );
  return handleJson<SkillCategoryState>(res);
}
