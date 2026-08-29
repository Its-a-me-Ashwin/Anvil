const API_BASE = import.meta.env.VITE_ANVIL_API_URL || 'http://localhost:8000';

export function musicUrl(projectId: string, filename: string): string {
  return `${API_BASE}/projects/${projectId}/music/${filename}`;
}
