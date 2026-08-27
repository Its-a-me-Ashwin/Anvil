const API_BASE = import.meta.env.VITE_ANVIL_API_URL || 'http://localhost:8000';

export interface Project {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
  session_id?: string;
}

export interface ProjectListResponse {
  projects: Project[];
}

export interface ChatResponse {
  response: string;
  project_name: string;
}

export interface SessionResponse {
  session_id: string;
  messages: { role: string; text: string }[];
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

export interface ProjectState {
  project_id: string;
  objective: string | null;
  objective_priority: string | null;
  constraints: Constraint[];
  inventory: InventoryItem[];
  objectives: ObjectiveItem[];
  decisions: Decision[];
  data_sources: DataSource[];
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

export async function chatProject(id: string, message: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/projects/${id}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return handleJson<ChatResponse>(res);
}

export async function getSession(sessionId: string): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
  return handleJson<SessionResponse>(res);
}

export async function getProjectState(id: string): Promise<ProjectState> {
  const res = await fetch(`${API_BASE}/projects/${id}/state`);
  return handleJson<ProjectState>(res);
}
