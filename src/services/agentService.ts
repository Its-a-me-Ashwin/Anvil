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
